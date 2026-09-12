const express = require('express');
const { ObjectId } = require('mongodb');
const { getDB } = require('../db');
const router = express.Router();

const DEPARTMENTS = ['Computer Science', 'Data Engineering', 'Business', 'Design', 'Mathematics'];
const ROLES = ['student', 'staff', 'professor'];

// --- LIST + search + filter, with registration counts via aggregation ---
router.get('/', async (req, res, next) => {
  try {
    const db = getDB();
    const { q, department, role } = req.query;

    const match = {};
    if (q) {
      match.$or = [
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } }
      ];
    }
    if (department) match.department = department;
    if (role) match.role = role;

    const users = await db.collection('users').aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'events',
          let: { uid: '$_id' },
          pipeline: [
            { $unwind: '$registrations' },
            { $match: { $expr: { $eq: ['$registrations.userId', '$$uid'] } } },
            { $count: 'count' }
          ],
          as: 'regInfo'
        }
      },
      {
        $addFields: {
          registrationCount: { $ifNull: [{ $arrayElemAt: ['$regInfo.count', 0] }, 0] }
        }
      },
      { $project: { regInfo: 0 } },
      { $sort: { lastName: 1 } }
    ]).toArray();

    res.render('users/list', { users, departments: DEPARTMENTS, roles: ROLES, query: req.query });
  } catch (err) { next(err); }
});

router.get('/new', (req, res) => {
  res.render('users/form', { user: null, departments: DEPARTMENTS, roles: ROLES, error: null });
});

router.post('/', async (req, res, next) => {
  try {
    const db = getDB();
    const body = req.body;
    const error = validateUserInput(body);
    if (error) {
      return res.status(400).render('users/form', { user: body, departments: DEPARTMENTS, roles: ROLES, error });
    }
    const interests = (body.interests || '').split(',').map((s) => s.trim()).filter(Boolean);
    try {
      await db.collection('users').insertOne({
        firstName: body.firstName.trim(),
        lastName: body.lastName.trim(),
        email: body.email.trim().toLowerCase(),
        department: body.department,
        role: body.role,
        interests,
        createdAt: new Date()
      });
      res.redirect('/users');
    } catch (e) {
      if (e.code === 11000) {
        return res.status(400).render('users/form', {
          user: body, departments: DEPARTMENTS, roles: ROLES, error: 'This email is already used by another user.'
        });
      }
      throw e;
    }
  } catch (err) { next(err); }
});

router.get('/:id/edit', async (req, res, next) => {
  try {
    const db = getDB();
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.params.id) });
    if (!user) return res.status(404).render('error', { message: 'User not found' });
    res.render('users/form', { user, departments: DEPARTMENTS, roles: ROLES, error: null });
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const db = getDB();
    const body = req.body;
    const error = validateUserInput(body);
    if (error) {
      return res.status(400).render('users/form', {
        user: { ...body, _id: req.params.id }, departments: DEPARTMENTS, roles: ROLES, error
      });
    }
    const interests = (body.interests || '').split(',').map((s) => s.trim()).filter(Boolean);
    try {
      await db.collection('users').updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: {
            firstName: body.firstName.trim(),
            lastName: body.lastName.trim(),
            email: body.email.trim().toLowerCase(),
            department: body.department,
            role: body.role,
            interests
          }
        }
      );
      res.redirect(`/users/${req.params.id}`);
    } catch (e) {
      if (e.code === 11000) {
        return res.status(400).render('users/form', {
          user: { ...body, _id: req.params.id }, departments: DEPARTMENTS, roles: ROLES,
          error: 'This email is already used by another user.'
        });
      }
      throw e;
    }
  } catch (err) { next(err); }
});

// --- DELETE (consistent strategy: block deletion if user still referenced by registrations) ---
router.delete('/:id', async (req, res, next) => {
  try {
    const db = getDB();
    const userId = new ObjectId(req.params.id);

    const referenced = await db.collection('events').countDocuments({ 'registrations.userId': userId });
    const organizes = await db.collection('events').countDocuments({ organizerId: userId });

    if (referenced > 0 || organizes > 0) {
      return res.status(400).render('error', {
        message: 'This user cannot be deleted: they still have event registrations or organize an event. Remove those references first.'
      });
    }

    await db.collection('users').deleteOne({ _id: userId });
    res.redirect('/users');
  } catch (err) { next(err); }
});

// --- DETAIL: participation history ---
router.get('/:id', async (req, res, next) => {
  try {
    const db = getDB();
    const userId = new ObjectId(req.params.id);
    const user = await db.collection('users').findOne({ _id: userId });
    if (!user) return res.status(404).render('error', { message: 'User not found' });

    const now = new Date();
    const events = await db.collection('events').aggregate([
      { $match: { 'registrations.userId': userId } },
      {
        $addFields: {
          myReg: {
            $first: {
              $filter: { input: '$registrations', as: 'r', cond: { $eq: ['$$r.userId', userId] } }
            }
          }
        }
      },
      { $sort: { startDate: 1 } }
    ]).toArray();

    const upcoming = events.filter((e) => new Date(e.startDate) >= now).length;
    const past = events.filter((e) => new Date(e.startDate) < now).length;

    res.render('users/detail', { user, events, upcoming, past });
  } catch (err) { next(err); }
});

function validateUserInput(body) {
  if (!body.firstName || !body.firstName.trim()) return 'First name is required.';
  if (!body.lastName || !body.lastName.trim()) return 'Last name is required.';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!body.email || !emailRegex.test(body.email.trim())) return 'A valid email is required.';
  if (!body.department) return 'Department is required.';
  if (!body.role) return 'Role is required.';
  return null;
}

module.exports = router;

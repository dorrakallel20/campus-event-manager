const express = require('express');
const { ObjectId } = require('mongodb');
const { getDB } = require('../db');
const router = express.Router();

const CATEGORIES = ['Workshop', 'Talk', 'Meetup', 'Hackathon', 'Career Fair', 'AI Clinic'];
const ALL_TAGS = [
  'Data Pipeline', 'Big Data', 'Data Ethics', 'LakeHouses', 'Spark',
  'Data Security', 'Machine Learning', 'NoSQL', 'AI Ethics', 'Career Coaching'
];

function confirmedCount(ev) {
  return (ev.registrations || []).filter((r) => r.status === 'confirmed').length;
}

// --- LIST + search + filters ---
router.get('/', async (req, res, next) => {
  try {
    const db = getDB();
    const { q, category, tag, time, sort } = req.query;

    const filter = {};
    if (q) filter.title = { $regex: q, $options: 'i' };
    if (category) filter.category = category;
    if (tag) filter.tags = tag; // array field match
    if (time === 'upcoming') filter.startDate = { $gte: new Date() };
    if (time === 'past') filter.startDate = { $lt: new Date() };

    const sortSpec = sort === 'desc' ? { startDate: -1 } : { startDate: 1 };

    const events = await db.collection('events').find(filter).sort(sortSpec).toArray();
    const eventsWithCounts = events.map((e) => ({ ...e, confirmed: confirmedCount(e) }));

    res.render('events/list', {
      events: eventsWithCounts,
      categories: CATEGORIES,
      tags: ALL_TAGS,
      query: req.query
    });
  } catch (err) { next(err); }
});

// --- NEW form ---
router.get('/new', async (req, res, next) => {
  try {
    const db = getDB();
    const allUsers = await db.collection('users').find().sort({ lastName: 1 }).toArray();
    res.render('events/form', { event: null, categories: CATEGORIES, allTags: ALL_TAGS, allUsers, error: null });
  } catch (err) { next(err); }
});

// --- CREATE ---
router.post('/', async (req, res, next) => {
  try {
    const db = getDB();
    const body = req.body;
    const errors = validateEventInput(body);
    if (errors.length) {
      const allUsers = await db.collection('users').find().sort({ lastName: 1 }).toArray();
      return res.status(400).render('events/form', {
        event: body, categories: CATEGORIES, allTags: ALL_TAGS, allUsers, error: errors.join(' ')
      });
    }
    const doc = buildEventDoc(body);
    await db.collection('events').insertOne(doc);
    res.redirect('/events');
  } catch (err) { next(err); }
});

// --- EDIT form ---
router.get('/:id/edit', async (req, res, next) => {
  try {
    const db = getDB();
    const event = await db.collection('events').findOne({ _id: new ObjectId(req.params.id) });
    if (!event) return res.status(404).render('error', { message: 'Event not found' });
    const allUsers = await db.collection('users').find().sort({ lastName: 1 }).toArray();
    res.render('events/form', { event, categories: CATEGORIES, allTags: ALL_TAGS, allUsers, error: null });
  } catch (err) { next(err); }
});

// --- UPDATE ---
router.put('/:id', async (req, res, next) => {
  try {
    const db = getDB();
    const body = req.body;
    const errors = validateEventInput(body);
    if (errors.length) {
      const allUsers = await db.collection('users').find().sort({ lastName: 1 }).toArray();
      return res.status(400).render('events/form', {
        event: { ...body, _id: req.params.id }, categories: CATEGORIES, allTags: ALL_TAGS, allUsers, error: errors.join(' ')
      });
    }
    const doc = buildEventDoc(body);
    await db.collection('events').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: {
          title: doc.title,
          description: doc.description,
          category: doc.category,
          tags: doc.tags,
          startDate: doc.startDate,
          endDate: doc.endDate,
          capacity: doc.capacity,
          location: doc.location
        }
      }
    );
    res.redirect(`/events/${req.params.id}`);
  } catch (err) { next(err); }
});

// --- DELETE ---
router.delete('/:id', async (req, res, next) => {
  try {
    const db = getDB();
    await db.collection('events').deleteOne({ _id: new ObjectId(req.params.id) });
    res.redirect('/events');
  } catch (err) { next(err); }
});

// --- DETAIL page (with registrations + $lookup for organizer/participants) ---
router.get('/:id', async (req, res, next) => {
  try {
    const db = getDB();
    const eventId = new ObjectId(req.params.id);

    const agg = await db.collection('events').aggregate([
      { $match: { _id: eventId } },
      {
        $lookup: {
          from: 'users',
          localField: 'organizerId',
          foreignField: '_id',
          as: 'organizer'
        }
      },
      { $unwind: { path: '$organizer', preserveNullAndEmptyArrays: true } }
    ]).toArray();

    const event = agg[0];
    if (!event) return res.status(404).render('error', { message: 'Event not found' });

    const confirmed = confirmedCount(event);
    const occupancy = event.capacity > 0 ? Math.round((confirmed / event.capacity) * 100) : 0;

    // Resolve participant users for display
    const userIds = event.registrations.map((r) => r.userId);
    const participantUsers = userIds.length
      ? await db.collection('users').find({ _id: { $in: userIds } }).toArray()
      : [];
    const userMap = {};
    participantUsers.forEach((u) => { userMap[u._id.toString()] = u; });

    const participants = event.registrations.map((r) => ({
      ...r,
      user: userMap[r.userId.toString()] || null
    }));

    const allUsers = await db.collection('users').find().sort({ lastName: 1 }).toArray();
    const registeredUserIds = new Set(event.registrations.map((r) => r.userId.toString()));

    res.render('events/detail', {
      event, confirmed, occupancy, participants, allUsers, registeredUserIds
    });
  } catch (err) { next(err); }
});

// --- REGISTER a user for the event ---
router.post('/:id/register', async (req, res, next) => {
  try {
    const db = getDB();
    const eventId = new ObjectId(req.params.id);
    const userId = new ObjectId(req.body.userId);

    const event = await db.collection('events').findOne({ _id: eventId });
    if (!event) return res.status(404).render('error', { message: 'Event not found' });

    const already = event.registrations.some((r) => r.userId.toString() === userId.toString() && r.status !== 'cancelled');
    if (already) {
      return res.status(400).render('error', { message: 'This user is already registered for this event.' });
    }

    const confirmed = confirmedCount(event);
    const status = confirmed >= event.capacity ? 'waiting' : 'confirmed';

    await db.collection('events').updateOne(
      { _id: eventId },
      { $push: { registrations: { userId, registeredAt: new Date(), status } } }
    );

    res.redirect(`/events/${req.params.id}`);
  } catch (err) { next(err); }
});

// --- CANCEL / remove a registration ---
router.post('/:id/unregister', async (req, res, next) => {
  try {
    const db = getDB();
    const eventId = new ObjectId(req.params.id);
    const userId = new ObjectId(req.body.userId);

    await db.collection('events').updateOne(
      { _id: eventId },
      { $pull: { registrations: { userId } } }
    );

    res.redirect(`/events/${req.params.id}`);
  } catch (err) { next(err); }
});

// --- Helpers ---
function validateEventInput(body) {
  const errors = [];
  if (!body.title || !body.title.trim()) errors.push('Title cannot be empty.');
  const capacity = Number(body.capacity);
  if (!capacity || capacity <= 0) errors.push('Capacity must be greater than 0.');
  if (body.startDate && body.endDate && new Date(body.endDate) < new Date(body.startDate)) {
    errors.push('End date cannot be before start date.');
  }
  return errors;
}

function buildEventDoc(body) {
  const tags = Array.isArray(body.tags) ? body.tags : (body.tags ? [body.tags] : []);
  return {
    title: body.title.trim(),
    description: body.description || '',
    category: body.category,
    tags,
    startDate: new Date(body.startDate),
    endDate: new Date(body.endDate),
    capacity: Number(body.capacity),
    location: {
      building: body.building || '',
      room: body.room || '',
      campus: body.campus || ''
    },
    registrations: [],
    organizerId: body.organizerId ? new ObjectId(body.organizerId) : null,
    createdAt: new Date()
  };
}

module.exports = router;

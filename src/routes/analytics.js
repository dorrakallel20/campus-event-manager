const express = require('express');
const { getDB } = require('../db');
const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const db = getDB();
    const events = db.collection('events');

    // --- A. Registrations by category ---
    const byCategory = await events.aggregate([
      { $unwind: '$registrations' },
      { $match: { 'registrations.status': 'confirmed' } },
      {
        $group: {
          _id: '$category',
          confirmedRegistrations: { $sum: 1 },
          eventIds: { $addToSet: '$_id' }
        }
      },
      { $project: { category: '$_id', confirmedRegistrations: 1, eventCount: { $size: '$eventIds' }, _id: 0 } },
      { $sort: { confirmedRegistrations: -1 } }
    ]).toArray();
    // Some categories may have zero confirmed regs; merge in categories with 0 via a second pass
    const allCategories = await events.distinct('category');
    const byCategoryFull = allCategories.map((cat) => {
      const found = byCategory.find((c) => c.category === cat);
      if (found) return found;
      return { category: cat, confirmedRegistrations: 0, eventCount: 0 };
    }).sort((a, b) => b.confirmedRegistrations - a.confirmedRegistrations);

    // --- B. Top 5 most popular events (by confirmed registrations) ---
    const topEvents = await events.aggregate([
      {
        $project: {
          title: 1,
          category: 1,
          capacity: 1,
          confirmed: {
            $size: { $filter: { input: '$registrations', as: 'r', cond: { $eq: ['$$r.status', 'confirmed'] } } }
          }
        }
      },
      { $addFields: { occupancy: { $round: [{ $multiply: [{ $divide: ['$confirmed', '$capacity'] }, 100] }, 0] } } },
      { $sort: { confirmed: -1 } },
      { $limit: 5 }
    ]).toArray();

    // --- C. Users with no registration (via $lookup + filter) ---
    const usersNoReg = await db.collection('users').aggregate([
      {
        $lookup: {
          from: 'events',
          let: { uid: '$_id' },
          pipeline: [
            { $unwind: '$registrations' },
            { $match: { $expr: { $eq: ['$registrations.userId', '$$uid'] } } }
          ],
          as: 'regs'
        }
      },
      { $match: { regs: { $size: 0 } } },
      { $project: { firstName: 1, lastName: 1, email: 1, department: 1 } }
    ]).toArray();

    // --- D. Events above average occupancy ---
    const withOccupancy = await events.aggregate([
      {
        $project: {
          title: 1,
          category: 1,
          capacity: 1,
          confirmed: {
            $size: { $filter: { input: '$registrations', as: 'r', cond: { $eq: ['$$r.status', 'confirmed'] } } }
          }
        }
      },
      { $addFields: { occupancy: { $multiply: [{ $divide: ['$confirmed', '$capacity'] }, 100] } } }
    ]).toArray();
    const avgOccupancy = withOccupancy.length
      ? withOccupancy.reduce((s, e) => s + e.occupancy, 0) / withOccupancy.length
      : 0;
    const aboveAverage = withOccupancy
      .filter((e) => e.occupancy > avgOccupancy)
      .sort((a, b) => b.occupancy - a.occupancy)
      .map((e) => ({ ...e, occupancy: Math.round(e.occupancy) }));

    // --- E. Most used tags ---
    const tagCounts = await events.aggregate([
      { $unwind: '$tags' },
      { $group: { _id: '$tags', eventCount: { $sum: 1 } } },
      { $project: { tag: '$_id', eventCount: 1, _id: 0 } },
      { $sort: { eventCount: -1 } }
    ]).toArray();

    // --- F. Events by month (with total registrations for those events) ---
    const byMonth = await events.aggregate([
      {
        $project: {
          year: { $year: '$startDate' },
          month: { $month: '$startDate' },
          regCount: { $size: '$registrations' }
        }
      },
      {
        $group: {
          _id: { year: '$year', month: '$month' },
          totalEvents: { $sum: 1 },
          totalRegistrations: { $sum: '$regCount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]).toArray();
    const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const byMonthFormatted = byMonth.map((m) => ({
      label: `${monthNames[m._id.month]} ${m._id.year}`,
      totalEvents: m.totalEvents,
      totalRegistrations: m.totalRegistrations
    }));

    res.render('analytics', {
      byCategory: byCategoryFull,
      topEvents,
      usersNoReg,
      aboveAverage,
      avgOccupancy: Math.round(avgOccupancy),
      tagCounts,
      byMonth: byMonthFormatted
    });
  } catch (err) { next(err); }
});

module.exports = router;

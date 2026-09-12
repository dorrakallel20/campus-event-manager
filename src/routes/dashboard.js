const express = require('express');
const { getDB } = require('../db');
const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const db = getDB();
    const now = new Date();

    const usersCount = await db.collection('users').countDocuments();
    const eventsCount = await db.collection('events').countDocuments();
    const upcomingCount = await db.collection('events').countDocuments({ startDate: { $gte: now } });

    // Total registrations: unwind the embedded array and count
    const totalRegAgg = await db.collection('events').aggregate([
      { $unwind: '$registrations' },
      { $count: 'total' }
    ]).toArray();
    const totalRegistrations = totalRegAgg[0] ? totalRegAgg[0].total : 0;

    // Next 5 upcoming events
    const nextEvents = await db.collection('events')
      .find({ startDate: { $gte: now } })
      .sort({ startDate: 1 })
      .limit(5)
      .toArray();

    // Most popular event based on confirmed registrations
    const popularAgg = await db.collection('events').aggregate([
      {
        $project: {
          title: 1,
          category: 1,
          confirmedCount: {
            $size: {
              $filter: {
                input: '$registrations',
                as: 'r',
                cond: { $eq: ['$$r.status', 'confirmed'] }
              }
            }
          }
        }
      },
      { $sort: { confirmedCount: -1 } },
      { $limit: 1 }
    ]).toArray();
    const mostPopular = popularAgg[0] || null;

    res.render('dashboard', {
      usersCount, eventsCount, upcomingCount, totalRegistrations, nextEvents, mostPopular
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

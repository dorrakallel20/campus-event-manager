/**
 * database/seed.js
 * Reproducible seed script: 15 users, 18 events, 6 categories,
 * 10 tags, 60+ registrations. Themed around aivancity
 * (MSc Data Engineering & Cloud Computing).
 * Run with: npm run seed (run `npm run init-db` first).
 */
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.DB_NAME || 'campus_events';

const departments = [
  'Data Engineering & Cloud Computing',
  'Artificial Intelligence',
  'International Business',
  'AI Design & Ethics',
  'Data Science'
];
const roles = ['student', 'staff', 'professor'];

// [firstName, lastName, deptIdx, roleIdx, interests]
const rawUsers = [
  ['Dorra', 'Kallel', 0, 0, ['Data Pipeline', 'NoSQL']],
  ['Ahmed', 'Gaaloul', 0, 0, ['Big Data', 'Spark']],
  ['Zaineb', 'Triki', 1, 0, ['Machine Learning', 'AI Ethics']],
  ['El Mahdi', 'Zaoui', 0, 0, ['LakeHouses', 'Data Security']],
  ['Ibtihal', 'Habtou', 4, 0, ['Data Ethics', 'Career Coaching']],
  ['Ahmed', 'El Edrissi', 0, 0, ['Spark', 'NoSQL']],
  ['Sofia', 'Bennani', 1, 1, ['AI Ethics', 'Machine Learning']],
  ['Karim', 'Haddad', 2, 0, ['Career Coaching', 'Big Data']],
  ['Lina', 'Moujahid', 3, 0, ['Data Ethics', 'AI Ethics']],
  ['Yassine', 'Amrani', 0, 2, ['Big Data', 'LakeHouses']],
  ['Nour', 'Chraibi', 4, 0, ['Machine Learning', 'Data Pipeline']],
  ['Omar', 'Belhaj', 0, 0, ['Data Security', 'NoSQL']],
  ['Salma', 'Idrissi', 1, 0, ['AI Ethics', 'Career Coaching']],
  ['Yasmine', 'Ferjani', 3, 0, ['Data Ethics', 'Machine Learning']],
  ['Mehdi', 'Cherif', 0, 1, ['Spark', 'Big Data']]
];

const categories = ['Workshop', 'Talk', 'Meetup', 'Hackathon', 'Career Fair', 'AI Clinic'];
const allTags = [
  'Data Pipeline', 'Big Data', 'Data Ethics', 'LakeHouses', 'Spark',
  'Data Security', 'Machine Learning', 'NoSQL', 'AI Ethics', 'Career Coaching'
];

// [title, category, tagIndices, month, day, durationHours, capacity, building, room, campus, organizerUserIndex, yearOverride]
const rawEvents = [
  ['Data Pipeline Design Workshop', 0, [0, 4], 8, 5, 3, 30, 'aivancity Campus', 'Room 101', 'Villejuif', 9],
  ['Big Data Fundamentals Talk', 1, [1, 6], 8, 20, 3, 25, 'aivancity Campus', 'Amphitheatre', 'Villejuif', 9],
  ['Data Ethics Roundtable', 2, [2, 8], 9, 1, 2, 40, 'aivancity Campus', 'Room 204', 'Villejuif', 4],
  ['Networking Night for DE Students', 2, [9, 1], 9, 3, 2, 50, 'aivancity Campus', 'Student Lounge', 'Villejuif', 7],
  ['Scala LakeHouse Bootcamp Day 1', 0, [3, 4], 9, 8, 4, 20, 'aivancity Campus', 'Lab A', 'Villejuif', 9],
  ['AI Ethics in Practice', 1, [8, 2], 9, 10, 1, 60, 'aivancity Campus', 'Amphitheatre', 'Villejuif', 2],
  ['Intro to NoSQL Databases', 0, [7, 0], 9, 15, 3, 25, 'aivancity Campus', 'Lab B', 'Villejuif', 11],
  ['Spark LakeHouse Hackathon', 3, [4, 3], 9, 20, 24, 40, 'aivancity Campus', 'Innovation Hub', 'Villejuif', 9],
  ['Data Security Essentials', 1, [5, 7], 10, 2, 2, 30, 'aivancity Campus', 'Room 204', 'Villejuif', 3],
  ['AI Clinic: Debug Your ML Model', 5, [6, 8], 10, 10, 3, 20, 'aivancity Campus', 'Lab A', 'Villejuif', 6],
  ['aivancity Career Fair', 4, [9, 1], 10, 18, 6, 100, 'aivancity Campus', 'Exhibition Hall', 'Villejuif', 7],
  ['Data Viz for LakeHouses Meetup', 2, [3, 1], 11, 5, 2, 5, 'aivancity Campus', 'Room 101', 'Villejuif', 10],
  ['Advanced Spark Architecture', 0, [4, 3], 11, 12, 3, 25, 'aivancity Campus', 'Lab B', 'Villejuif', 9],
  ['Cloud Computing for LakeHouses', 0, [3, 4], 11, 22, 5, 40, 'aivancity Campus', 'Room 204', 'Villejuif', 14],
  ['Winter Hackathon: Data Security Edition', 3, [5, 7], 12, 3, 8, 8, 'aivancity Campus', 'Innovation Hub', 'Villejuif', 9],
  ['AI Clinic: Ethics Review Session', 5, [8, 6], 12, 12, 2, 45, 'aivancity Campus', 'Lab A', 'Villejuif', 6],
  ['New Year Career Coaching Brunch', 2, [9, 2], 1, 15, 2, 35, 'aivancity Campus', 'Student Lounge', 'Villejuif', 7, 2027],
  ['Intro to Big Data & LakeHouses', 0, [1, 3], 1, 22, 3, 20, 'aivancity Campus', 'Room 101', 'Villejuif', 9, 2027]
];

// registrations per event index (sum >= 40), and whether the event should be marked "full"
const regPlan = [
  { count: 0 },
  { count: 6 },
  { count: 3 },
  { count: 0 },
  { count: 4 },
  { count: 8 },
  { count: 2 },
  { count: 5 },
  { count: 3 },
  { count: 4 },
  { count: 6 },
  { count: 5, full: true },
  { count: 3 },
  { count: 4 },
  { count: 8, full: true },
  { count: 3 },
  { count: 2 },
  { count: 0 }
];

function slug(name) {
  return name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z]/g, '');
}

async function seed() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  console.log('Clearing existing data...');
  await db.collection('users').deleteMany({});
  await db.collection('events').deleteMany({});

  // --- Insert users ---
  const userDocs = rawUsers.map(([firstName, lastName, deptIdx, roleIdx, interests]) => ({
    _id: new ObjectId(),
    firstName,
    lastName,
    email: `${slug(firstName)}.${slug(lastName)}@aivancity.ai`,
    department: departments[deptIdx],
    role: roles[roleIdx],
    interests,
    createdAt: new Date('2026-08-01T09:00:00Z')
  }));
  await db.collection('users').insertMany(userDocs);
  console.log(`Inserted ${userDocs.length} users`);

  // --- Insert events ---
  const eventDocs = rawEvents.map((e) => {
    const [title, catIdx, tagIdxs, month, day, durHours, capacity, building, room, campus, organizerIdx, yearOverride] = e;
    const year = yearOverride || 2026;
    const start = new Date(Date.UTC(year, month - 1, day, 9, 0, 0));
    const end = new Date(start.getTime() + durHours * 60 * 60 * 1000);
    return {
      _id: new ObjectId(),
      title,
      description: `${title} is an aivancity campus event in the ${categories[catIdx]} category, open to MSc Data Engineering & Cloud Computing students and staff.`,
      category: categories[catIdx],
      tags: tagIdxs.map((i) => allTags[i]),
      startDate: start,
      endDate: end,
      capacity,
      location: { building, room, campus },
      organizerId: userDocs[organizerIdx]._id,
      registrations: [],
      createdAt: new Date('2026-09-01T09:00:00Z')
    };
  });

  // --- Build registrations for each event according to regPlan ---
  let totalRegs = 0;
  eventDocs.forEach((ev, idx) => {
    const plan = regPlan[idx];
    const count = plan.count;
    for (let k = 0; k < count; k++) {
      const userIdx = (idx * 7 + k) % userDocs.length;
      let status = 'confirmed';
      if (!plan.full) {
        const m = k % 10;
        if (m === 8) status = 'cancelled';
        else if (m === 9) status = 'waiting';
      }
      ev.registrations.push({
        userId: userDocs[userIdx]._id,
        registeredAt: new Date(ev.createdAt.getTime() + k * 60 * 60 * 1000),
        status
      });
      totalRegs++;
    }
  });

  await db.collection('events').insertMany(eventDocs);
  console.log(`Inserted ${eventDocs.length} events`);
  console.log(`Inserted ${totalRegs} embedded registrations across events`);

  const distinctCategories = new Set(eventDocs.map((e) => e.category));
  const distinctTags = new Set(eventDocs.flatMap((e) => e.tags));
  console.log(`Distinct categories: ${distinctCategories.size} (${[...distinctCategories].join(', ')})`);
  console.log(`Distinct tags: ${distinctTags.size} (${[...distinctTags].join(', ')})`);

  console.log('\nSeed complete.');
  await client.close();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

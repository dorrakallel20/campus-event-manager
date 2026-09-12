/**
 * database/init.js
 * Creates required indexes and applies basic schema validation
 * for the campus_events database.
 *
 * Run with: npm run init-db
 */
const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.DB_NAME || 'campus_events';

async function init() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  // Make sure collections exist
  const existing = (await db.listCollections().toArray()).map((c) => c.name);
  if (!existing.includes('users')) await db.createCollection('users');
  if (!existing.includes('events')) await db.createCollection('events');

  // --- Indexes ---
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  console.log('Index created: users.email (unique)');

  await db.collection('events').createIndex({ startDate: 1 });
  console.log('Index created: events.startDate');

  await db.collection('events').createIndex({ category: 1 });
  console.log('Index created: events.category');

  // Extra useful index for tag filtering (multikey)
  await db.collection('events').createIndex({ tags: 1 });
  console.log('Index created: events.tags');

  // --- Schema validation (moderate: applies to new/updated docs, tolerant of legacy data) ---
  await db.command({
    collMod: 'events',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['title', 'capacity', 'startDate', 'endDate'],
        properties: {
          title: {
            bsonType: 'string',
            minLength: 1,
            description: 'title must be a non-empty string'
          },
          capacity: {
            bsonType: ['int', 'double'],
            minimum: 1,
            description: 'capacity must be a number greater than 0'
          }
        }
      }
    },
    validationLevel: 'moderate',
    validationAction: 'warn'
  });
  console.log('Schema validation applied to events collection (warn mode)');

  console.log('\nDatabase initialization complete.');
  await client.close();
}

init().catch((err) => {
  console.error('Init failed:', err);
  process.exit(1);
});

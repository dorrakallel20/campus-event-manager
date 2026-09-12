const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.DB_NAME || 'campus_events';

let client;
let db;

async function connectDB() {
  if (db) return db;
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);
  console.log(`Connected to MongoDB database: ${dbName}`);
  return db;
}

function getDB() {
  if (!db) throw new Error('Database not initialized. Call connectDB first.');
  return db;
}

module.exports = { connectDB, getDB };

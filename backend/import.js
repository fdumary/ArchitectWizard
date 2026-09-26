// backend/import.js
const path = require('path');
const fs = require('fs');
const { MongoClient } = require('mongodb');

// Load environment variables from backend or root directory
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

// Helper to normalize county names (trims spaces and handles hyphens)
function formatCounty(rawCounty) {
  if (!rawCounty) return 'Orange';
  const trimmed = rawCounty.trim();
  if (trimmed.toLowerCase() === 'miami-dade') {
    return 'Miami-Dade';
  }
  // Standard title-casing (e.g., "ORANGE" -> "Orange")
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

async function importFromJSON() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error('FATAL: MONGO_URI is missing. Check your .env file.');
    process.exit(1);
  }

  // Find projects.json in backend/ or root
  let jsonPath = path.resolve(__dirname, 'projects.json');
  if (!fs.existsSync(jsonPath)) {
    jsonPath = path.resolve(__dirname, '../projects.json');
  }

  if (!fs.existsSync(jsonPath)) {
    console.error('ERROR: projects.json not found. Run fetch_live_data.js first.');
    process.exit(1);
  }

  console.log(`Loading records from: ${jsonPath}`);
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const dbName = process.env.DB_NAME || 'hackathon';
    const colName = process.env.COLLECTION_NAME || 'projects';
    const col = client.db(dbName).collection(colName);

    // 1. Sanitize and Insert New Records from projects.json
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const arr = JSON.parse(rawData);

    arr.forEach(p => {
      p.county = formatCounty(p.county);
      p.startTime = new Date(p.startTime);
      p.endTime = new Date(p.endTime);
      p.createdAt = new Date();
    });

    const res = await col.insertMany(arr);
    console.log(`Successfully inserted ${res.insertedCount} projects into MongoDB Atlas (${dbName}.${colName})!`);

    // 2. Clean Up Any Older Records Already in the Database
    const cursor = col.find({});
    let cleanedCount = 0;

    for await (const doc of cursor) {
      if (doc.county) {
        const cleaned = formatCounty(doc.county);
        if (cleaned !== doc.county) {
          await col.updateOne(
            { _id: doc._id },
            { $set: { county: cleaned } }
          );
          cleanedCount++;
        }
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up trailing spaces on ${cleanedCount} existing documents in MongoDB.`);
    }

  } catch (err) {
    console.error('Import failed:', err);
  } finally {
    await client.close();
  }
}

importFromJSON();
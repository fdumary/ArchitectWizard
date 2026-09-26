require('dotenv').config();
const fs = require('fs');
const { MongoClient } = require('mongodb');

async function importFromJSON() {
  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    const col = client.db(process.env.DB_NAME || 'hackathon').collection('projects');
    const arr = JSON.parse(fs.readFileSync('projects.json', 'utf8'));
    arr.forEach(p => {
      // Normalize county: trim, proper case, preserve hyphens
      const rawCounty = (p.county || "Orange").trim();
      p.county = rawCounty
        .toLowerCase()
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('-');
      p.startTime = new Date(p.startTime);
      p.endTime = new Date(p.endTime);
      p.createdAt = new Date();
    });
    const res = await col.insertMany(arr);
    console.log('Inserted', res.insertedCount, 'projects from projects.json');
  } finally {
    await client.close();
  }
}

importFromJSON();

require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || 'hackathon';
const COLLECTION_NAME = process.env.COLLECTION_NAME || 'projects';

if (!MONGO_URI) {
  console.error("FATAL: MONGO_URI environment variable is missing.");
  process.exit(1);
}

const app = express();
app.use(express.json());

let db;
let projectsCollection;

// Initialize MongoDB Client
const client = new MongoClient(MONGO_URI);

async function startServer() {
  try {
    await client.connect();
    db = client.db(DB_NAME);
    projectsCollection = db.collection(COLLECTION_NAME);

    // Recommended: create compound indexes for fast lookups
    await projectsCollection.createIndex({ county: 1, startTime: 1, endTime: 1 });

    console.log(`Connected successfully to MongoDB Atlas: [${DB_NAME}] -> [${COLLECTION_NAME}]`);

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to connect to MongoDB Atlas:', err);
    process.exit(1);
  }
}

// CREATE PROJECT
app.post('/api/projects', async (req, res) => {
  try {
    const { title, description, county, startTime, endTime, company } = req.body;

    if (!title || !county || !startTime || !endTime) {
      return res.status(400).json({ error: 'title, county, startTime, endTime required' });
    }

    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'title cannot be left empty' });
    }

    const parsedStartTime = new Date(startTime);
    const parsedEndTime = new Date(endTime);

    if (isNaN(parsedStartTime.getTime()) || isNaN(parsedEndTime.getTime())) {
      return res.status(400).json({ error: 'Invalid format for start or end time' });
    }

    if (parsedStartTime >= parsedEndTime) {
      return res.status(400).json({ error: 'start time must be before end time' });
    }

    const newProject = {
      title,
      description: description || '',
      county,
      startTime: parsedStartTime,
      endTime: parsedEndTime,
      company: company || 'Unspecified',
      createdAt: new Date()
    };

    const result = await projectsCollection.insertOne(newProject);
    console.log(`Created project: ${title} in ${county} (ID: ${result.insertedId})`);

    res.status(201).json({ _id: result.insertedId, ...newProject });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// GET TOP 3 UPCOMING PROJECTS BY COUNTY
app.get('/api/projects/county/:county', async (req, res) => {
  try {
    const { county } = req.params;

    // Matches county and sorts by earliest start time, returns top 3
    const countyProjects = await projectsCollection
      .find({ county: { $regex: new RegExp(`^${county}$`, 'i') } }) // case-insensitive match
      .sort({ startTime: 1 })
      .limit(3)
      .toArray();

    res.json({
      county,
      projects: countyProjects
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// CHECK FOR CONFLICTS (Accurate Temporal Overlap)
// Two intervals [A, B] and [C, D] overlap if: (A <= D) and (B >= C)
app.get('/api/projects/conflicts', async (req, res) => {
  try {
    const { county, startTime, endTime } = req.query;

    if (!county || !startTime || !endTime) {
      return res.status(400).json({ error: 'county, startTime, endTime required' });
    }

    const queryStart = new Date(startTime);
    const queryEnd = new Date(endTime);

    const conflicts = await projectsCollection
      .find({
        county: { $regex: new RegExp(`^${county}$`, 'i') },
        startTime: { $lte: queryEnd },
        endTime: { $gte: queryStart }
      })
      .sort({ startTime: 1 })
      .toArray();

    res.json({
      county,
      conflictCount: conflicts.length,
      conflicts
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to check conflicts' });
  }
});

// HEALTH CHECK
app.get('/health', async (req, res) => {
  try {
    const count = await projectsCollection.countDocuments();
    res.json({ status: 'ok', database: DB_NAME, totalProjects: count });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

startServer();
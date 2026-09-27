require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const { MongoClient } = require('mongodb');
const { extractProjectFields } = require('./ai');

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || 'hackathon';
const COLLECTION_NAME = process.env.COLLECTION_NAME || 'projects';

if (!MONGO_URI) {
  console.error("FATAL: MONGO_URI environment variable is missing.");
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static('frontend/public'));

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

    // Prevent duplicate (title + county) entries
    await projectsCollection.createIndex(
      { title: 1, county: 1 },
      { unique: true }
    );

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

    // Normalize county to match index/format
    const rawCounty = (county || "Orange").trim();
    const cleanCounty = rawCounty
      .toLowerCase()
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('-');
    const cleanTitle = (title || '').trim();

    const existing = await projectsCollection.findOne({
      title: cleanTitle,
      county: cleanCounty,
    });
    if (existing) {
      return res.status(409).json({ error: 'Project already exists for this title and county' });
    }

    // Check for conflicts before saving
    const queryStart = new Date(startTime);
    const queryEnd = new Date(endTime);
    const projectDurationMs = queryEnd.getTime() - queryStart.getTime();
    const conflictCheck = await projectsCollection.find({
      county: { $regex: new RegExp(`^\\s*${cleanCounty}\\s*$`, 'i') },
      startTime: { $lte: queryEnd },
      endTime: { $gte: queryStart },
      endTime: { $gte: new Date() }
    }).sort({ startTime: 1 }).toArray();
    if (conflictCheck.length > 0) {
      // Find the next free window of the same duration after the conflicts
      let candidateStart = new Date(queryStart);
      for (const c of conflictCheck) {
        const cStart = new Date(c.startTime);
        const cEnd = new Date(c.endTime);
        if (candidateStart.getTime() + projectDurationMs <= cStart.getTime()) {
          break; // free window found before this conflict
        }
        candidateStart = new Date(cEnd.getTime() + 24*60*60*1000); // move past this conflict
      }
      const nearestWindow = candidateStart;
      return res.status(409).json({ error: 'Project conflicts with existing schedule', conflicts: conflictCheck, nearestWindow: nearestWindow.toISOString() });
    }

    const newProjectStart = new Date(startTime);
    const today = new Date();
    today.setHours(0,0,0,0);
    if (newProjectStart < today) {
      return res.status(400).json({ error: 'Project start date must be today or in the future.' });
    }

    const newProject = {
      title: cleanTitle,
      description: description || '',
      county: cleanCounty,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
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

// AI NLP EXTRACTION — Gemini
// POST /api/ai/extract  { text, audioBase64?, mimeType? }
// Returns extracted { county, startTime, endTime, title, description }
app.post('/api/ai/extract', async (req, res) => {
  try {
    const { text, audioBase64, mimeType } = req.body;
    if (!text && !audioBase64) {
      return res.status(400).json({ error: 'text or audioBase64 required' });
    }
    const extracted = await extractProjectFields({ text, audioBase64, mimeType });
    res.json({ success: true, ...extracted });
  } catch (err) {
    console.error('AI extraction error:', err.message || err);
    res.status(502).json({ error: 'AI service unavailable', detail: err.message || err });
  }
});

// AI EXTRACT + CONFLICT CHECK — convenience route
// POST /api/ai/check-conflicts  same body as /api/ai/extract
// Runs extraction then conflict check against the given county/period.
app.post('/api/ai/check-conflicts', async (req, res) => {
  try {
    const { text, audioBase64, mimeType } = req.body;
    if (!text && !audioBase64) {
      return res.status(400).json({ error: 'text or audioBase64 required' });
    }
    const { county, startTime, endTime, title, description } = await extractProjectFields({
      text, audioBase64, mimeType,
    });
    if (!county || !startTime || !endTime) {
      return res.status(400).json({ error: 'Gemini could not extract county/startTime/endTime' });
    }
    const conflicts = await projectsCollection
      .find({
        county: { $regex: new RegExp(`^\\s*${county}\\s*$`, 'i') },
        startTime: { $lte: new Date(endTime) },
        endTime: { $gte: new Date(startTime) },
      })
      .sort({ startTime: 1 })
      .toArray();
    const projectDurationMs = new Date(endTime).getTime() - new Date(startTime).getTime();
    // Find next free window of the same duration as the input project
    let candidateStart = new Date(startTime);
    for (const c of conflicts) {
      const cStart = new Date(c.startTime);
      const cEnd = new Date(c.endTime);
      if (candidateStart.getTime() + projectDurationMs <= cStart.getTime()) {
        break;
      }
      candidateStart = new Date(cEnd.getTime() + 24*60*60*1000);
    }
    const nearestWindow = candidateStart;
    res.json({ success: true, county, startTime, endTime, title, description, conflictCount: conflicts.length, conflicts, nearestWindow: nearestWindow ? nearestWindow.toISOString() : null });
  } catch (err) {
    console.error('AI conflict check error:', err.message || err);
    res.status(502).json({ error: 'AI service unavailable', detail: err.message || err });
  }
});

// GET TOP 3 UPCOMING PROJECTS BY COUNTY
app.get('/api/projects/county/:county', async (req, res) => {
  try {
    const { county } = req.params;

    // Matches county and sorts by earliest start time, returns top 3
    const now = new Date();
    const countyProjects = await projectsCollection
      .find({
        county: { $regex: new RegExp(`^\\s*${county}\\s*$`, 'i') },
        endTime: { $gte: now }
      }) // case-insensitive match
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
        county: { $regex: new RegExp(`^\\s*${county}\\s*$`, 'i') },
        startTime: { $lte: queryEnd },
        endTime: { $gte: queryStart }
      })
      .sort({ startTime: 1 })
      .toArray();

    const projectDurationMs = queryEnd.getTime() - queryStart.getTime();
    let candidateStart = new Date(queryStart);
    for (const c of conflicts) {
      const cStart = new Date(c.startTime);
      const cEnd = new Date(c.endTime);
      if (candidateStart.getTime() + projectDurationMs <= cStart.getTime()) {
        break;
      }
      candidateStart = new Date(cEnd.getTime() + 24*60*60*1000);
    }
    const nearestWindow = candidateStart;
    res.json({
      county,
      conflictCount: conflicts.length,
      conflicts,
      nearestWindow: nearestWindow.toISOString()
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
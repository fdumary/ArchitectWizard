require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || 'hackathon';
const COLLECTION_NAME = process.env.COLLECTION_NAME || 'projects';

const seedProjects = [
  {
    title: "Curry Ford 230kV Substation Modernization",
    company: "Duke Energy Florida",
    county: "Orange",
    description: "Transformer replacements and substation terminal rebuild.",
    startTime: new Date("2026-10-01T08:00:00Z"),
    endTime: new Date("2026-12-15T17:00:00Z"),
    createdAt: new Date()
  },
  {
    title: "Orlando Southeast Distribution Tie-In",
    company: "Florida Power & Light (FPL)",
    county: "Orange",
    description: "Underground feeder ties and right-of-way pole hardening.",
    startTime: new Date("2026-11-01T08:00:00Z"),
    endTime: new Date("2027-02-28T17:00:00Z"),
    createdAt: new Date()
  },
  {
    title: "Apopka Transmission Feeder Reconductoring",
    company: "Duke Energy Florida",
    county: "Orange",
    description: "Reconductoring 115kV line to higher thermal rating.",
    startTime: new Date("2027-01-10T08:00:00Z"),
    endTime: new Date("2027-05-30T17:00:00Z"),
    createdAt: new Date()
  },

  // --- VOLUSIA COUNTY PROJECTS ---
  {
    title: "DeLand Industrial Substation and Transmission Project",
    company: "Duke Energy Florida",
    county: "Volusia",
    description: "Building new substation on SR 15A and line interconnection.",
    startTime: new Date("2026-10-15T08:00:00Z"),
    endTime: new Date("2027-04-15T17:00:00Z"),
    createdAt: new Date()
  },
  {
    title: "Daytona Beach Grid Resiliency Hardening",
    company: "Florida Power & Light (FPL)",
    county: "Volusia",
    description: "Concrete pole upgrades and automated lateral switches.",
    startTime: new Date("2026-11-20T08:00:00Z"),
    endTime: new Date("2027-03-01T17:00:00Z"),
    createdAt: new Date()
  },

  // --- LEON COUNTY UPGRADES ---
  {
    title: "Baker Tap to Miccosukee 115kV Upgrade",
    company: "Duke Energy Florida",
    county: "Leon",
    description: "Steel monopole replacements and line clearance improvements.",
    startTime: new Date("2026-09-01T08:00:00Z"),
    endTime: new Date("2027-01-31T17:00:00Z"),
    createdAt: new Date()
  }
];

async function seed() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    await collection.deleteMany({});
    console.log("Cleared existing records.");

    const res = await collection.insertMany(seedProjects);
    console.log(`Seeded ${res.insertedCount} utility construction projects successfully.`);
  } catch (err) {
    console.error("Seeding failed:", err);
  } finally {
    await client.close();
  }
}

seed();
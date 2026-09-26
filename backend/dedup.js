// backend/dedup.js
const path = require('path');
const { MongoClient } = require('mongodb');

// Automatically resolve .env from backend/ or parent directory
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

async function removeDuplicates() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error('FATAL: MONGO_URI is missing. Check your .env file.');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const dbName = process.env.DB_NAME || 'hackathon';
    const colName = process.env.COLLECTION_NAME || 'projects';
    const collection = client.db(dbName).collection(colName);

    console.log(`Connecting to [${dbName}.${colName}] to scan for duplicates...`);

    // 1. Group by normalized title + county to find duplicates
    const duplicates = await collection.aggregate([
      {
        $group: {
          _id: {
            title: { $trim: { input: '$title' } },
            county: { $trim: { input: '$county' } }
          },
          count: { $sum: 1 },
          ids: { $push: '$_id' }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]).toArray();

    if (duplicates.length === 0) {
      console.log('No duplicate projects found! Database is clean.');
      return;
    }

    console.log(`Found ${duplicates.length} distinct project titles with duplicate entries.`);

    let totalDeleted = 0;

    for (const group of duplicates) {
      // Keep the first (oldest) document, mark the remaining IDs for deletion
      const [keepId, ...deleteIds] = group.ids;

      const deleteResult = await collection.deleteMany({
        _id: { $in: deleteIds }
      });

      totalDeleted += deleteResult.deletedCount;
      console.log(`- Project: "${group._id.title}" in ${group._id.county} -> Deleted ${deleteResult.deletedCount} duplicate(s), kept [${keepId}]`);
    }

    const remainingCount = await collection.countDocuments();
    console.log(`\nSuccessfully removed ${totalDeleted} duplicate documents.`);
    console.log(`Total projects remaining in collection: ${remainingCount}`);

  } catch (err) {
    console.error('Deduplication failed:', err);
  } finally {
    await client.close();
  }
}

removeDuplicates();
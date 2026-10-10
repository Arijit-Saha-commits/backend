import mongoose from 'mongoose';

let memoryServerInstance = null;

export const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (mongoUri && mongoUri.trim() !== '') {
      try {
        const conn = await mongoose.connect(mongoUri, {
          serverSelectionTimeoutMS: 4000,
        });
        console.log(`[MongoDB] Connected successfully to: ${conn.connection.host}/${conn.connection.name}`);
        return;
      } catch (directErr) {
        console.warn(`[MongoDB] Could not connect to configured MONGODB_URI: ${directErr.message}`);
        console.log('[MongoDB] Falling back to embedded in-memory MongoDB so the system runs smoothly...');
      }
    }

    // Fallback: Start MongoDB in-memory server for development/testing if no external DB is reachable
    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      memoryServerInstance = await MongoMemoryServer.create();
      const inMemoryUri = memoryServerInstance.getUri();
      const conn = await mongoose.connect(inMemoryUri);
      console.log(`[MongoDB Memory Server] Connected to in-memory database: ${inMemoryUri}`);
      console.log(`[MongoDB Note] To use real MongoDB Atlas, set MONGODB_URI in backend/.env`);
    } catch (memErr) {
      console.error('[MongoDB Error] Neither configured URI nor in-memory Mongo could start:', memErr.message);
      throw memErr;
    }
  } catch (error) {
    console.error(`[MongoDB Connection Error] ${error.message}`);
    process.exit(1);
  }
};

export const closeDB = async () => {
  try {
    await mongoose.connection.close();
    if (memoryServerInstance) {
      await memoryServerInstance.stop();
    }
  } catch (err) {
    console.error('Error closing MongoDB connection:', err);
  }
};

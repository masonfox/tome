import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

/**
 * Test database setup and teardown utilities
 */

let mongoServer: MongoMemoryServer | null = null;

/**
 * Start an in-memory MongoDB instance and connect Mongoose
 * Call this in beforeAll()
 */
export async function setupTestDatabase(): Promise<void> {
  if (mongoServer) {
    throw new Error("Test database already running. Did you forget to call teardownTestDatabase()?");
  }

  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
}

/**
 * Disconnect Mongoose and stop the in-memory MongoDB instance
 * Call this in afterAll()
 */
export async function teardownTestDatabase(): Promise<void> {
  await mongoose.disconnect();

  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
}

/**
 * Clear all collections in the test database
 * Call this in beforeEach() or afterEach() to reset state between tests
 */
export async function clearTestDatabase(): Promise<void> {
  if (!mongoose.connection.db) {
    throw new Error("Database not connected");
  }

  const collections = await mongoose.connection.db.collections();

  for (const collection of collections) {
    await collection.deleteMany({});
  }
}

/**
 * Get the test database URI
 * Useful for debugging or advanced configuration
 */
export function getTestDatabaseUri(): string {
  if (!mongoServer) {
    throw new Error("Test database not running");
  }

  return mongoServer.getUri();
}

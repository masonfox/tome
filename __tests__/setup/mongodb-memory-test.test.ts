import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

/**
 * Test to verify mongodb-memory-server works with Bun
 * If this passes, we can use it for all Mongoose tests
 */

let mongoServer: MongoMemoryServer;

describe("mongodb-memory-server compatibility", () => {
  beforeAll(async () => {
    try {
      // Start in-memory MongoDB instance
      mongoServer = await MongoMemoryServer.create();
      const uri = mongoServer.getUri();

      // Connect mongoose
      await mongoose.connect(uri);
    } catch (error) {
      console.error("Failed to start mongodb-memory-server:", error);
      throw error;
    }
  });

  afterAll(async () => {
    // Cleanup
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  test("can create and query a simple document", async () => {
    // Define a simple schema
    const TestSchema = new mongoose.Schema({
      name: String,
      value: Number,
    });

    const TestModel = mongoose.model("Test", TestSchema);

    // Create a document
    const doc = await TestModel.create({
      name: "test",
      value: 42,
    });

    // Query it back
    const found = await TestModel.findById(doc._id);

    // Assertions
    expect(found).toBeDefined();
    expect(found?.name).toBe("test");
    expect(found?.value).toBe(42);
  });

  test("can use aggregation pipeline", async () => {
    const TestSchema = new mongoose.Schema({
      category: String,
      amount: Number,
    });

    const TestModel = mongoose.model("TestAgg", TestSchema);

    // Insert test data
    await TestModel.create([
      { category: "A", amount: 10 },
      { category: "A", amount: 20 },
      { category: "B", amount: 30 },
    ]);

    // Run aggregation
    const result = await TestModel.aggregate([
      {
        $group: {
          _id: "$category",
          total: { $sum: "$amount" },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Assertions
    expect(result).toHaveLength(2);
    expect(result[0]._id).toBe("A");
    expect(result[0].total).toBe(30);
    expect(result[1]._id).toBe("B");
    expect(result[1].total).toBe(30);
  });
});

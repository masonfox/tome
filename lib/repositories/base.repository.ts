import { eq, SQL } from "drizzle-orm";
import { SQLiteTableWithColumns } from "drizzle-orm/sqlite-core";
import { getDatabase } from "@/lib/db/context";

/**
 * Base repository with common CRUD operations
 * Generic type T is the select type, and InsertT is the insert type
 */
export abstract class BaseRepository<
  T extends Record<string, any>,
  InsertT extends Record<string, any>,
  TableT extends SQLiteTableWithColumns<any>
> {
  protected table: TableT;

  constructor(protected tableSchema: TableT) {
    this.table = tableSchema;
  }

   /**
    * Get the appropriate database instance (test or production)
    * Called for each operation to allow test database switching
    */
   protected getDatabase() {
     return getDatabase();
   }

  /**
   * Find a single record by ID
   */
  async findById(id: number): Promise<T | undefined> {
    return this.getDatabase()
      .select()
      .from(this.tableSchema)
      .where(eq(this.tableSchema.id, id))
      .get() as T | undefined;
  }

  /**
   * Find all records
   */
  async findAll(): Promise<T[]> {
    return this.getDatabase().select().from(this.tableSchema).all() as T[];
  }

  /**
   * Find records matching a where clause
   */
  async find(where: SQL): Promise<T[]> {
    return this.getDatabase().select().from(this.tableSchema).where(where).all() as T[];
  }

  /**
   * Find one record matching a where clause
   */
  async findOne(where: SQL): Promise<T | undefined> {
    return this.getDatabase().select().from(this.tableSchema).where(where).get() as T | undefined;
  }

  /**
   * Count all records
   */
  async count(): Promise<number> {
    const result = this.getDatabase()
      .select({ count: sql<number>`count(*)` })
      .from(this.tableSchema)
      .get();
    return result?.count ?? 0;
  }

  /**
   * Count records matching a where clause
   */
  async countWhere(where: SQL): Promise<number> {
    const result = this.getDatabase()
      .select({ count: sql<number>`count(*)` })
      .from(this.tableSchema)
      .where(where)
      .get();
    return result?.count ?? 0;
  }

  /**
   * Create a new record
   */
  async create(data: InsertT): Promise<T> {
    const result = this.getDatabase().insert(this.tableSchema).values(data).returning().all();
    return result[0] as T;
  }

  /**
   * Update a record by ID
   */
  async update(id: number, data: Partial<InsertT>): Promise<T | undefined> {
    const result = this.getDatabase()
      .update(this.tableSchema)
      .set(data)
      .where(eq(this.tableSchema.id, id))
      .returning()
      .all();
    return result[0] as T | undefined;
  }

  /**
   * Delete a record by ID
   */
  async delete(id: number): Promise<boolean> {
    const result = this.getDatabase().delete(this.tableSchema).where(eq(this.tableSchema.id, id)).run();
    return result.changes > 0;
  }

  /**
   * Delete all records matching a where clause
   */
  async deleteWhere(where: SQL): Promise<number> {
    const result = this.getDatabase().delete(this.table).where(where).run();
    return result.changes;
  }

  /**
   * Check if a record exists by ID
   */
  async exists(id: number): Promise<boolean> {
    const result = await this.findById(id);
    return result !== undefined;
  }
}

// Import sql for queries
import { sql } from "drizzle-orm";

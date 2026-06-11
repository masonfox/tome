import { eq, desc, sql } from 'drizzle-orm';
import { getDatabase } from '@/lib/db/context';
import { 
  koreaderDocumentMappings, 
  type KoReaderDocumentMapping,
  type NewKoReaderDocumentMapping 
} from '@/lib/db/schema/koreader';

/**
 * Repository for KoReader document-to-book mappings
 * Manages the mapping between KoReader document hashes and Tome books
 */
class KoReaderMappingRepository {
  /**
   * Find a mapping by KoReader document hash
   */
  async findByDocumentHash(documentHash: string): Promise<KoReaderDocumentMapping | null> {
    const db = getDatabase();
    const result = db.select()
      .from(koreaderDocumentMappings)
      .where(eq(koreaderDocumentMappings.documentHash, documentHash))
      .get();
    return result || null;
  }

  /**
   * Find all mappings for a specific book
   */
  async findByBookId(bookId: number): Promise<KoReaderDocumentMapping[]> {
    const db = getDatabase();
    return db.select()
      .from(koreaderDocumentMappings)
      .where(eq(koreaderDocumentMappings.bookId, bookId))
      .orderBy(desc(koreaderDocumentMappings.lastSyncedAt))
      .all();
  }

  /**
   * Create a new document-to-book mapping
   */
  async create(data: NewKoReaderDocumentMapping): Promise<KoReaderDocumentMapping> {
    const db = getDatabase();
    const result = db.insert(koreaderDocumentMappings)
      .values(data)
      .returning()
      .get();
    return result;
  }

  /**
   * Update an existing mapping
   */
  async update(id: number, data: Partial<NewKoReaderDocumentMapping>): Promise<KoReaderDocumentMapping | null> {
    const db = getDatabase();
    const result = db.update(koreaderDocumentMappings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(koreaderDocumentMappings.id, id))
      .returning()
      .get();
    return result || null;
  }

  /**
   * Update the last synced timestamp for a document
   */
  async updateLastSynced(documentHash: string, syncedAt: Date): Promise<void> {
    const db = getDatabase();
    db.update(koreaderDocumentMappings)
      .set({ lastSyncedAt: syncedAt, updatedAt: new Date() })
      .where(eq(koreaderDocumentMappings.documentHash, documentHash))
      .run();
  }

  /**
   * Delete a mapping by ID
   */
  async delete(id: number): Promise<boolean> {
    const db = getDatabase();
    const result = db.delete(koreaderDocumentMappings)
      .where(eq(koreaderDocumentMappings.id, id))
      .run() as unknown as { changes: number };
    return result.changes > 0;
  }

  /**
   * Find all mappings
   */
  async findAll(): Promise<KoReaderDocumentMapping[]> {
    const db = getDatabase();
    return db.select()
      .from(koreaderDocumentMappings)
      .orderBy(desc(koreaderDocumentMappings.lastSyncedAt))
      .all();
  }

  /**
   * Count total mappings
   */
  async count(): Promise<number> {
    const db = getDatabase();
    const result = db.select({ count: sql<number>`count(*)` })
      .from(koreaderDocumentMappings)
      .get();
    return result?.count ?? 0;
  }
}

export const koreaderMappingRepository = new KoReaderMappingRepository();

// Base Repository 클래스
import * as SQLite from 'expo-sqlite';
import { createQueryUtils } from '../queryUtils';

export abstract class BaseRepository {
  protected db: SQLite.SQLiteDatabase;
  protected query: ReturnType<typeof createQueryUtils>;

  constructor(database: SQLite.SQLiteDatabase) {
    this.db = database;
    this.query = createQueryUtils(database);
  }

  // 기본 CRUD 템플릿
  protected async findById<T>(table: string, id: number): Promise<T | null> {
    return this.query
      .select()
      .from(table)
      .where('id = ?', id)
      .executeFirst<T>();
  }

  protected async findAll<T>(table: string, limit?: number, offset?: number): Promise<T[]> {
    const builder = this.query.select().from(table);

    if (limit) {
      builder.limit(limit, offset);
    }

    return builder.execute<T>();
  }

  protected async findWhere<T>(
    table: string,
    conditions: Record<string, any>,
    limit?: number,
    offset?: number
  ): Promise<T[]> {
    const builder = this.query.select().from(table);

    // 조건들을 WHERE 절에 추가
    const keys = Object.keys(conditions);
    if (keys.length > 0) {
      const firstKey = keys[0];
      builder.where(`${firstKey} = ?`, conditions[firstKey]);

      for (let i = 1; i < keys.length; i++) {
        const key = keys[i];
        builder.and(`${key} = ?`, conditions[key]);
      }
    }

    if (limit) {
      builder.limit(limit, offset);
    }

    return builder.execute<T>();
  }

  protected async count(table: string, conditions?: Record<string, any>): Promise<number> {
    const builder = this.query.select('COUNT(*) as count').from(table);

    if (conditions) {
      const keys = Object.keys(conditions);
      if (keys.length > 0) {
        const firstKey = keys[0];
        builder.where(`${firstKey} = ?`, conditions[firstKey]);

        for (let i = 1; i < keys.length; i++) {
          const key = keys[i];
          builder.and(`${key} = ?`, conditions[key]);
        }
      }
    }

    const result = await builder.executeFirst<{ count: number }>();
    return result?.count || 0;
  }

  protected async insert<T extends Record<string, any>>(
    table: string,
    data: Omit<T, 'id'>
  ): Promise<{ id: number; changes: number }> {
    const result = await this.query.insert().into(table).values(data).execute();
    return {
      id: result.lastInsertRowId,
      changes: result.changes,
    };
  }

  protected async update<T extends Record<string, any>>(
    table: string,
    id: number,
    data: Partial<Omit<T, 'id'>>
  ): Promise<{ changes: number }> {
    return this.query
      .update()
      .table(table)
      .set(data)
      .where('id = ?', id)
      .execute();
  }

  protected async delete(table: string, id: number): Promise<{ changes: number }> {
    return this.query.delete().from(table).where('id = ?', id).execute();
  }

  // 유틸리티 메서드
  protected async exists(table: string, conditions: Record<string, any>): Promise<boolean> {
    const count = await this.count(table, conditions);
    return count > 0;
  }

  protected async executeRaw<T>(query: string, params: any[] = []): Promise<T[]> {
    try {
      console.log('Executing raw query:', query, 'with params:', params);
      return (await this.db.getAllAsync(query, params)) as T[];
    } catch (error) {
      console.error('Raw query failed:', error);
      throw error;
    }
  }

  protected async executeRawFirst<T>(query: string, params: any[] = []): Promise<T | null> {
    const results = await this.executeRaw<T>(query, params);
    return results.length > 0 ? results[0] : null;
  }
}
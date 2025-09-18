// SQLite 쿼리 유틸리티 함수들
import * as SQLite from 'expo-sqlite';

export class QueryBuilder {
  private query: string = '';
  private params: any[] = [];

  constructor(private db: SQLite.SQLiteDatabase) {}

  // SELECT 구문 시작
  select(columns: string | string[] = '*'): this {
    const columnStr = Array.isArray(columns) ? columns.join(', ') : columns;
    this.query = `SELECT ${columnStr}`;
    return this;
  }

  // FROM 절
  from(table: string): this {
    this.query += ` FROM ${table}`;
    return this;
  }

  // JOIN 절
  join(table: string, condition: string, type: 'INNER' | 'LEFT' | 'RIGHT' = 'INNER'): this {
    this.query += ` ${type} JOIN ${table} ON ${condition}`;
    return this;
  }

  // WHERE 절
  where(condition: string, ...params: any[]): this {
    this.query += ` WHERE ${condition}`;
    this.params.push(...params);
    return this;
  }

  // AND 조건
  and(condition: string, ...params: any[]): this {
    this.query += ` AND ${condition}`;
    this.params.push(...params);
    return this;
  }

  // OR 조건
  or(condition: string, ...params: any[]): this {
    this.query += ` OR ${condition}`;
    this.params.push(...params);
    return this;
  }

  // ORDER BY 절
  orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.query += ` ORDER BY ${column} ${direction}`;
    return this;
  }

  // LIMIT 절
  limit(count: number, offset?: number): this {
    this.query += ` LIMIT ${count}`;
    if (offset !== undefined) {
      this.query += ` OFFSET ${offset}`;
    }
    return this;
  }

  // GROUP BY 절
  groupBy(columns: string | string[]): this {
    const columnStr = Array.isArray(columns) ? columns.join(', ') : columns;
    this.query += ` GROUP BY ${columnStr}`;
    return this;
  }

  // HAVING 절
  having(condition: string, ...params: any[]): this {
    this.query += ` HAVING ${condition}`;
    this.params.push(...params);
    return this;
  }

  // 쿼리 실행 (복수 행)
  async execute<T = any>(): Promise<T[]> {
    try {
      console.log('Executing query:', this.query, 'with params:', this.params);
      const result = await this.db.getAllAsync(this.query, this.params);
      return result as T[];
    } catch (error) {
      console.error('Query execution failed:', error);
      throw error;
    }
  }

  // 쿼리 실행 (단일 행)
  async executeFirst<T = any>(): Promise<T | null> {
    const results = await this.execute<T>();
    return results.length > 0 ? results[0] : null;
  }

  // 개수 쿼리
  async count(): Promise<number> {
    const countQuery = `SELECT COUNT(*) as count FROM (${this.query})`;
    try {
      const result = await this.db.getFirstAsync(countQuery, this.params) as { count: number };
      return result?.count || 0;
    } catch (error) {
      console.error('Count query failed:', error);
      return 0;
    }
  }

  // 쿼리 문자열 반환
  toString(): string {
    return this.query;
  }

  // 파라미터 반환
  getParams(): any[] {
    return this.params;
  }
}

// INSERT 쿼리 빌더
export class InsertBuilder {
  private _table: string = '';
  private columns: string[] = [];
  private _values: any[] = [];
  private onConflict: string = '';

  constructor(private db: SQLite.SQLiteDatabase) {}

  into(table: string): this {
    this._table = table;
    return this;
  }

  values(data: Record<string, any>): this {
    this.columns = Object.keys(data);
    this._values = Object.values(data);
    return this;
  }

  onConflictIgnore(): this {
    this.onConflict = 'OR IGNORE';
    return this;
  }

  onConflictReplace(): this {
    this.onConflict = 'OR REPLACE';
    return this;
  }

  async execute(): Promise<{ lastInsertRowId: number; changes: number }> {
    const placeholders = this._values.map(() => '?').join(', ');
    const columnsStr = this.columns.join(', ');
    const query = `INSERT ${this.onConflict} INTO ${this._table} (${columnsStr}) VALUES (${placeholders})`;

    try {
      console.log('Executing insert:', query, 'with values:', this._values);
      const result = await this.db.runAsync(query, this._values);
      return {
        lastInsertRowId: result.lastInsertRowId!,
        changes: result.changes,
      };
    } catch (error) {
      console.error('Insert failed:', error);
      throw error;
    }
  }
}

// UPDATE 쿼리 빌더
export class UpdateBuilder {
  private _table: string = '';
  private setData: Record<string, any> = {};
  private whereConditions: string[] = [];
  private whereParams: any[] = [];

  constructor(private db: SQLite.SQLiteDatabase) {}

  table(tableName: string): this {
    this._table = tableName;
    return this;
  }

  set(data: Record<string, any>): this {
    this.setData = { ...this.setData, ...data };
    return this;
  }

  where(condition: string, ...params: any[]): this {
    this.whereConditions.push(condition);
    this.whereParams.push(...params);
    return this;
  }

  async execute(): Promise<{ changes: number }> {
    const setClauses = Object.keys(this.setData).map(key => `${key} = ?`);
    const setValues = Object.values(this.setData);

    let query = `UPDATE ${this._table} SET ${setClauses.join(', ')}`;
    const allParams = [...setValues, ...this.whereParams];

    if (this.whereConditions.length > 0) {
      query += ` WHERE ${this.whereConditions.join(' AND ')}`;
    }

    try {
      console.log('Executing update:', query, 'with params:', allParams);
      const result = await this.db.runAsync(query, allParams);
      return { changes: result.changes };
    } catch (error) {
      console.error('Update failed:', error);
      throw error;
    }
  }
}

// DELETE 쿼리 빌더
export class DeleteBuilder {
  private table: string = '';
  private whereConditions: string[] = [];
  private whereParams: any[] = [];

  constructor(private db: SQLite.SQLiteDatabase) {}

  from(table: string): this {
    this.table = table;
    return this;
  }

  where(condition: string, ...params: any[]): this {
    this.whereConditions.push(condition);
    this.whereParams.push(...params);
    return this;
  }

  async execute(): Promise<{ changes: number }> {
    let query = `DELETE FROM ${this.table}`;

    if (this.whereConditions.length > 0) {
      query += ` WHERE ${this.whereConditions.join(' AND ')}`;
    }

    try {
      console.log('Executing delete:', query, 'with params:', this.whereParams);
      const result = await this.db.runAsync(query, this.whereParams);
      return { changes: result.changes };
    } catch (error) {
      console.error('Delete failed:', error);
      throw error;
    }
  }
}

// 트랜잭션 헬퍼
export class TransactionHelper {
  constructor(private db: SQLite.SQLiteDatabase) {}

  async execute<T>(callback: (tx: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> {
    // Expo SQLite v16는 자동으로 트랜잭션을 관리하므로
    // 직접 트랜잭션을 시작할 필요가 없음
    try {
      return await callback(this.db);
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  }
}

// 쿼리 유틸리티 팩토리
export function createQueryUtils(db: SQLite.SQLiteDatabase) {
  return {
    select: (columns?: string | string[]) => new QueryBuilder(db).select(columns),
    insert: () => new InsertBuilder(db),
    update: () => new UpdateBuilder(db),
    delete: () => new DeleteBuilder(db),
    transaction: () => new TransactionHelper(db),
  };
}
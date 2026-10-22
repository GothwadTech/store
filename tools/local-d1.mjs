import { DatabaseSync } from 'node:sqlite';

function normalizeParam(value) {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return value;
}

class LocalD1Statement {
  constructor(db, sql, params = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }

  bind(...params) {
    return new LocalD1Statement(this.db, this.sql, params.map(normalizeParam));
  }

  async first(colName) {
    const stmt = this.db.prepare(this.sql);
    const row = stmt.get(...this.params) ?? null;
    if (!row) return null;
    if (colName !== undefined) return row[colName] ?? null;
    return { ...row };
  }

  async all() {
    const stmt = this.db.prepare(this.sql);
    const rows = stmt.all(...this.params).map((r) => ({ ...r }));
    return {
      success: true,
      results: rows,
      meta: { rows_read: rows.length, rows_written: 0 },
    };
  }

  async run() {
    const stmt = this.db.prepare(this.sql);
    const info = stmt.run(...this.params);
    return {
      success: true,
      results: [],
      meta: {
        changes: Number(info.changes ?? 0),
        last_row_id: Number(info.lastInsertRowid ?? 0),
        rows_read: 0,
        rows_written: Number(info.changes ?? 0),
      },
    };
  }
}

export class LocalD1Database {
  constructor(filename = ':memory:') {
    this.sqlite = new DatabaseSync(filename);
    this.sqlite.exec('PRAGMA foreign_keys = ON;');
  }

  prepare(sql) {
    return new LocalD1Statement(this.sqlite, sql);
  }

  async batch(statements) {
    const results = [];
    this.sqlite.exec('BEGIN');
    try {
      for (const stmt of statements) {
        const trimmed = stmt.sql.trim().toUpperCase();
        if (trimmed.startsWith('SELECT') || trimmed.includes(' RETURNING ')) {
          results.push(await stmt.all());
        } else {
          results.push(await stmt.run());
        }
      }
      this.sqlite.exec('COMMIT');
      return results;
    } catch (err) {
      try {
        this.sqlite.exec('ROLLBACK');
      } catch {
        /* ignore rollback failure */
      }
      throw err;
    }
  }

  async exec(sql) {
    this.sqlite.exec(sql);
    return { count: 1, duration: 0 };
  }

  close() {
    this.sqlite.close();
  }
}

export function createLocalD1(filename = ':memory:') {
  return new LocalD1Database(filename);
}

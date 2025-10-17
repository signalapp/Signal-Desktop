// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import SQL from '@signalapp/sqlcipher';

import type { ReadableDB, WritableDB } from '../../sql/Interface.std.js';
import type { QueryTemplate } from '../../sql/util.std.js';
import { SCHEMA_VERSIONS } from '../../sql/migrations/index.node.js';
import { consoleLogger } from '../../util/consoleLogger.std.js';

const { noop } = lodash;

export function createDB(): WritableDB {
  const db = new SQL(':memory:') as WritableDB;
  db.initTokenizer();
  return db;
}

export function updateToVersion(db: WritableDB, version: number): void {
  const startVersion = db.pragma('user_version', { simple: true }) as number;
  if (startVersion === version) {
    return;
  }

  const silentLogger = {
    ...consoleLogger,
    info: noop,
  };

  for (const { version: currentVersion, update } of SCHEMA_VERSIONS) {
    if (currentVersion <= startVersion) {
      continue;
    }

    db.transaction(() => {
      update(db, silentLogger, startVersion);
      db.pragma(`user_version = ${version}`);
    })();

    if (currentVersion === version) {
      return;
    }
  }

  throw new Error(`Migration to ${version} not found`);
}

type TableRows = ReadonlyArray<
  Record<string, string | number | Buffer | null | Record<string, unknown>>
>;

export function insertData(
  db: WritableDB,
  table: string,
  rows: TableRows
): void {
  for (const row of rows) {
    db.prepare(
      `
      INSERT INTO ${table} (${Object.keys(row).join(', ')})
      VALUES (${Object.values(row)
        .map(() => '?')
        .join(', ')});
    `
    ).run(
      Object.values(row).map(v => {
        if (Buffer.isBuffer(v)) {
          return v;
        }
        if (v != null && typeof v === 'object') {
          return JSON.stringify(v);
        }
        return v;
      })
    );
  }
}

export function getTableData(db: ReadableDB, table: string): TableRows {
  return db
    .prepare(`SELECT * FROM ${table}`)
    .all()
    .map(row => {
      const result: Record<
        string,
        string | number | null | Record<string, unknown>
      > = {};
      for (const [key, value] of Object.entries(row)) {
        if (value == null) {
          continue;
        }
        if (value instanceof Uint8Array) {
          result[key] = Buffer.from(value).toString('hex');
          continue;
        }
        try {
          if (typeof value !== 'string' || !value.trim().startsWith('{')) {
            throw new Error('skip');
          }
          result[key] = JSON.parse(value) as Record<string, unknown>;
        } catch {
          result[key] = value;
        }
      }
      return result;
    });
}

export function explain(db: ReadableDB, template: QueryTemplate): string {
  const [query, params] = template;
  const details = db
    .prepare(`EXPLAIN QUERY PLAN ${query}`)
    .all<{ detail: string }>(params)
    .map(({ detail }) => detail)
    .join('\n');

  return details;
}

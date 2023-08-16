// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { noop } from 'lodash';
import type { Database } from '@signalapp/better-sqlite3';

import { SCHEMA_VERSIONS } from '../../sql/migrations';
import { consoleLogger } from '../../util/consoleLogger';

export function updateToVersion(db: Database, version: number): void {
  const startVersion = db.pragma('user_version', { simple: true });

  const silentLogger = {
    ...consoleLogger,
    info: noop,
  };

  for (const run of SCHEMA_VERSIONS) {
    run(startVersion, db, silentLogger);

    const currentVersion = db.pragma('user_version', { simple: true });

    if (currentVersion === version) {
      return;
    }
  }

  throw new Error(`Migration to ${version} not found`);
}

type TableRows = ReadonlyArray<
  Record<string, string | number | null | Record<string, unknown>>
>;

export function insertData(db: Database, table: string, rows: TableRows): void {
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
        if (v != null && typeof v === 'object') {
          return JSON.stringify(v);
        }
        return v;
      })
    );
  }
}

export function getTableData(db: Database, table: string): TableRows {
  return db
    .prepare(`SELECT * FROM ${table}`)
    .all()
    .map((row: Record<string, string | number | null>) => {
      const result: Record<
        string,
        string | number | null | Record<string, unknown>
      > = {};
      for (const [key, value] of Object.entries(row)) {
        if (value == null) {
          continue;
        }
        try {
          if (typeof value !== 'string') {
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

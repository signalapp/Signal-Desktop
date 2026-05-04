// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { WritableDB } from '../Interface.std.ts';
import { sql } from '../util.std.ts';
import EMOJI_DATA from '../../../build/emoji-data.json' with { type: 'json' };

type PrevRow = Readonly<{
  shortName?: string;
  lastUsage?: number;
}>;

type UpdatedRow = Readonly<{
  emoji: string;
  lastUsedAt: number;
}>;

function getPrevRows(db: WritableDB): ReadonlyArray<PrevRow> {
  const [query, params] = sql`
    SELECT * FROM emojis;
  `;

  return db.prepare(query).all<PrevRow>(params);
}

function toUpdatedRows(
  prevRows: ReadonlyArray<PrevRow>
): ReadonlyArray<UpdatedRow> {
  if (prevRows.length === 0) {
    return [];
  }

  const shortNameToParentEmoji = new Map<string, string>();
  for (const [emoji, info] of Object.entries(EMOJI_DATA.emojis)) {
    shortNameToParentEmoji.set(info.shortName, emoji);
  }

  const updatedRows: Array<UpdatedRow> = [];

  for (const prevRow of prevRows) {
    if (prevRow.shortName == null || prevRow.lastUsage == null) {
      continue;
    }

    const emoji = shortNameToParentEmoji.get(prevRow.shortName);
    if (emoji != null) {
      updatedRows.push({
        emoji,
        lastUsedAt: prevRow.lastUsage,
      });
    }
  }

  return updatedRows;
}

function createNewTable(db: WritableDB) {
  const [query] = sql`
    CREATE TABLE recentEmojis (
      emoji TEXT NOT NULL PRIMARY KEY,
      lastUsedAt INTEGER NOT NULL
    ) STRICT;

    CREATE INDEX recentEmojis_order ON recentEmojis (lastUsedAt DESC);
  `;
  db.exec(query);
}

function insertUpdatedRows(
  db: WritableDB,
  updatedRows: ReadonlyArray<UpdatedRow>
) {
  if (updatedRows.length === 0) {
    return;
  }

  const statement = db.prepare(`
    INSERT INTO recentEmojis (emoji, lastUsedAt) VALUES ($emoji, $lastUsedAt);
  `);

  for (const updatedRow of updatedRows) {
    statement.run({
      emoji: updatedRow.emoji,
      lastUsedAt: updatedRow.lastUsedAt,
    });
  }
}

function dropOldTable(db: WritableDB) {
  const [query] = sql`
    DROP TABLE emojis;
  `;
  db.exec(query);
}

export default function updateToSchemaVersion1720(db: WritableDB): void {
  createNewTable(db);
  const prevRows = getPrevRows(db);
  const updatedRows = toUpdatedRows(prevRows);
  insertUpdatedRows(db, updatedRows);
  dropOldTable(db);
}

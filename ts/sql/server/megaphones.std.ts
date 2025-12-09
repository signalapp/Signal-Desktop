// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReadableDB, WritableDB } from '../Interface.std.js';
import { sql } from '../util.std.js';
import type {
  RemoteMegaphoneId,
  RemoteMegaphoneType,
} from '../../types/Megaphone.std.js';
import { strictAssert } from '../../util/assert.std.js';

type MegaphoneRow = Readonly<
  Omit<
    RemoteMegaphoneType,
    'isFinished' | 'primaryCtaData' | 'secondaryCtaData'
  > & {
    isFinished: 0 | 1;
    primaryCtaDataJson: string | null;
    secondaryCtaDataJson: string | null;
  }
>;

function megaphoneToRow(megaphone: RemoteMegaphoneType): MegaphoneRow {
  return {
    ...megaphone,
    isFinished: megaphone.isFinished ? 1 : 0,
    primaryCtaDataJson:
      megaphone.primaryCtaData != null
        ? JSON.stringify(megaphone.primaryCtaData)
        : null,
    secondaryCtaDataJson:
      megaphone.secondaryCtaData != null
        ? JSON.stringify(megaphone.secondaryCtaData)
        : null,
  };
}

function rowToMegaphone(megaphoneRow: MegaphoneRow): RemoteMegaphoneType {
  return {
    ...megaphoneRow,
    isFinished: megaphoneRow.isFinished === 1,
    primaryCtaData:
      megaphoneRow.primaryCtaDataJson != null
        ? JSON.parse(megaphoneRow.primaryCtaDataJson)
        : null,
    secondaryCtaData:
      megaphoneRow.secondaryCtaDataJson != null
        ? JSON.parse(megaphoneRow.secondaryCtaDataJson)
        : null,
  };
}

export function hasMegaphone(
  db: ReadableDB,
  megaphoneId: RemoteMegaphoneId
): boolean {
  const [query, params] = sql`
    SELECT EXISTS (
      SELECT 1 FROM megaphones
      WHERE id = ${megaphoneId}
    )
  `;
  const result = db.prepare(query, { pluck: true }).get<number>(params);
  return result === 1;
}

export function getAllMegaphones(
  db: ReadableDB
): ReadonlyArray<RemoteMegaphoneType> {
  const [query, params] = sql`
    SELECT * FROM megaphones
  `;
  return db
    .prepare(query)
    .all<MegaphoneRow>(params)
    .map(row => rowToMegaphone(row));
}

function _insertMegaphone(
  db: WritableDB,
  megaphone: RemoteMegaphoneType
): void {
  const row = megaphoneToRow(megaphone);
  const [query, params] = sql`
    INSERT INTO megaphones (
      id,
      desktopMinVersion,
      priority,
      dontShowBeforeEpochMs,
      dontShowAfterEpochMs,
      showForNumberOfDays,
      primaryCtaId,
      secondaryCtaId,
      primaryCtaDataJson,
      secondaryCtaDataJson,
      conditionalId,
      title,
      body,
      primaryCtaText,
      secondaryCtaText,
      imagePath,
      localeFetched,
      shownAt,
      snoozedAt,
      snoozeCount,
      isFinished
    ) VALUES (
      ${row.id},
      ${row.desktopMinVersion},
      ${row.priority},
      ${row.dontShowBeforeEpochMs},
      ${row.dontShowAfterEpochMs},
      ${row.showForNumberOfDays},
      ${row.primaryCtaId},
      ${row.secondaryCtaId},
      ${row.primaryCtaDataJson},
      ${row.secondaryCtaDataJson},
      ${row.conditionalId},
      ${row.title},
      ${row.body},
      ${row.primaryCtaText},
      ${row.secondaryCtaText},
      ${row.imagePath},
      ${row.localeFetched},
      ${row.shownAt},
      ${row.snoozedAt},
      ${row.snoozeCount},
      ${row.isFinished}
    )
  `;
  db.prepare(query).run(params);
}

export function createMegaphone(
  db: WritableDB,
  megaphone: RemoteMegaphoneType
): void {
  return db.transaction(() => {
    _insertMegaphone(db, megaphone);
  })();
}

export function updateMegaphone(
  db: WritableDB,
  megaphone: RemoteMegaphoneType
): void {
  const row = megaphoneToRow(megaphone);
  const [query, params] = sql`
    UPDATE megaphones
    SET
      desktopMinVersion = ${row.desktopMinVersion},
      priority = ${row.priority},
      dontShowBeforeEpochMs = ${row.dontShowBeforeEpochMs},
      dontShowAfterEpochMs = ${row.dontShowAfterEpochMs},
      showForNumberOfDays = ${row.showForNumberOfDays},
      primaryCtaId = ${row.primaryCtaId},
      secondaryCtaId = ${row.secondaryCtaId},
      primaryCtaDataJson = ${row.primaryCtaDataJson},
      secondaryCtaDataJson = ${row.secondaryCtaDataJson},
      conditionalId = ${row.conditionalId},
      title = ${row.title},
      body = ${row.body},
      primaryCtaText = ${row.primaryCtaText},
      secondaryCtaText = ${row.secondaryCtaText},
      imagePath = ${row.imagePath},
      localeFetched = ${row.localeFetched},
      shownAt = ${row.shownAt},
      snoozedAt = ${row.snoozedAt},
      snoozeCount = ${row.snoozeCount},
      isFinished = ${row.isFinished}
    WHERE
      id = ${row.id}
  `;
  db.prepare(query).run(params);
}

export function deleteMegaphone(
  db: WritableDB,
  megaphoneId: RemoteMegaphoneId
): void {
  const [query, params] = sql`
    DELETE FROM megaphones
    WHERE id = ${megaphoneId}
  `;
  const result = db.prepare(query).run(params);
  strictAssert(
    result.changes === 1,
    `deleteMegaphone: Expected changes: 1, Actual: ${result.changes}`
  );
}

export function internalDeleteAllMegaphones(db: WritableDB): number {
  const [query, params] = sql`
    DELETE FROM megaphones
  `;
  const result = db.prepare(query).run(params);
  return result.changes;
}

export function getAllMegaphoneImageLocalPaths(db: ReadableDB): Set<string> {
  const localPaths = db
    .prepare('SELECT imagePath FROM megaphones WHERE imagePath IS NOT NULL', {
      pluck: true,
    })
    .all<string>();
  return new Set(localPaths);
}

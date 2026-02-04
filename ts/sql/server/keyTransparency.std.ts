// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { AciString } from '../../types/ServiceId.std.js';
import type { ReadableDB, WritableDB } from '../Interface.std.js';
import { sql } from '../util.std.js';

export function getAllKTAcis(db: ReadableDB): Array<AciString> {
  const [query, params] = sql`
    SELECT aci
    FROM key_transparency_account_data
  `;
  return db.prepare(query, { pluck: true }).all<AciString>(params);
}

export function getKTAccountData(
  db: ReadableDB,
  aci: AciString
): Uint8Array | undefined {
  const [query, params] = sql`
    SELECT data
    FROM key_transparency_account_data
    WHERE aci IS ${aci}
  `;
  return db.prepare(query, { pluck: true }).get<Uint8Array>(params);
}

export function setKTAccountData(
  db: WritableDB,
  aci: AciString,
  data: Uint8Array
): void {
  const [query, params] = sql`
    INSERT OR REPLACE INTO key_transparency_account_data
      (aci, data)
    VALUES
      (${aci}, ${data});
  `;
  db.prepare(query).run(params);
}

export function removeAllKTAccountData(db: WritableDB): void {
  db.exec(`
    DELETE FROM key_transparency_account_data;
  `);
}

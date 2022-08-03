// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from 'better-sqlite3';
import { isNumber, last } from 'lodash';

export type EmptyQuery = [];
export type ArrayQuery = Array<Array<null | number | bigint | string>>;
export type Query = {
  [key: string]: null | number | bigint | string | Uint8Array;
};
export type JSONRows = Array<{ readonly json: string }>;

export type TableType =
  | 'attachment_downloads'
  | 'conversations'
  | 'identityKeys'
  | 'items'
  | 'messages'
  | 'preKeys'
  | 'senderKeys'
  | 'sessions'
  | 'signedPreKeys'
  | 'stickers'
  | 'unprocessed';

// This value needs to be below SQLITE_MAX_VARIABLE_NUMBER.
const MAX_VARIABLE_COUNT = 100;

export function objectToJSON<T>(data: T): string {
  return JSON.stringify(data);
}

export function jsonToObject<T>(json: string): T {
  return JSON.parse(json);
}

//
// Database helpers
//

export function getSQLiteVersion(db: Database): string {
  const { sqlite_version: version } = db
    .prepare<EmptyQuery>('select sqlite_version() AS sqlite_version')
    .get();

  return version;
}

export function getSchemaVersion(db: Database): number {
  return db.pragma('schema_version', { simple: true });
}

export function setUserVersion(db: Database, version: number): void {
  if (!isNumber(version)) {
    throw new Error(`setUserVersion: version ${version} is not a number`);
  }
  db.pragma(`user_version = ${version}`);
}

export function getUserVersion(db: Database): number {
  return db.pragma('user_version', { simple: true });
}

export function getSQLCipherVersion(db: Database): string | undefined {
  return db.pragma('cipher_version', { simple: true });
}

//
// Various table helpers
//

export function batchMultiVarQuery<ValueT>(
  db: Database,
  values: Array<ValueT>,
  query: (batch: Array<ValueT>) => void
): [];
export function batchMultiVarQuery<ValueT, ResultT>(
  db: Database,
  values: Array<ValueT>,
  query: (batch: Array<ValueT>) => Array<ResultT>
): Array<ResultT>;

export function batchMultiVarQuery<ValueT, ResultT>(
  db: Database,
  values: Array<ValueT>,
  query:
    | ((batch: Array<ValueT>) => void)
    | ((batch: Array<ValueT>) => Array<ResultT>)
): Array<ResultT> {
  if (values.length > MAX_VARIABLE_COUNT) {
    const result: Array<ResultT> = [];
    db.transaction(() => {
      for (let i = 0; i < values.length; i += MAX_VARIABLE_COUNT) {
        const batch = values.slice(i, i + MAX_VARIABLE_COUNT);
        const batchResult = query(batch);
        if (Array.isArray(batchResult)) {
          result.push(...batchResult);
        }
      }
    })();
    return result;
  }

  const result = query(values);
  return Array.isArray(result) ? result : [];
}

export function createOrUpdate<Key extends string | number>(
  db: Database,
  table: TableType,
  data: Record<string, unknown> & { id: Key }
): void {
  const { id } = data;
  if (!id) {
    throw new Error('createOrUpdate: Provided data did not have a truthy id');
  }

  db.prepare<Query>(
    `
    INSERT OR REPLACE INTO ${table} (
      id,
      json
    ) values (
      $id,
      $json
    )
    `
  ).run({
    id,
    json: objectToJSON(data),
  });
}

export function bulkAdd(
  db: Database,
  table: TableType,
  array: Array<Record<string, unknown> & { id: string | number }>
): void {
  db.transaction(() => {
    for (const data of array) {
      createOrUpdate(db, table, data);
    }
  })();
}

export function getById<Key extends string | number, Result = unknown>(
  db: Database,
  table: TableType,
  id: Key
): Result | undefined {
  const row = db
    .prepare<Query>(
      `
      SELECT *
      FROM ${table}
      WHERE id = $id;
      `
    )
    .get({
      id,
    });

  if (!row) {
    return undefined;
  }

  return jsonToObject(row.json);
}

export function removeById<Key extends string | number>(
  db: Database,
  table: TableType,
  id: Key | Array<Key>
): void {
  if (!Array.isArray(id)) {
    db.prepare<Query>(
      `
      DELETE FROM ${table}
      WHERE id = $id;
      `
    ).run({ id });
    return;
  }

  if (!id.length) {
    throw new Error('removeById: No ids to delete!');
  }

  const removeByIdsSync = (ids: Array<string | number>): void => {
    db.prepare<ArrayQuery>(
      `
      DELETE FROM ${table}
      WHERE id IN ( ${id.map(() => '?').join(', ')} );
      `
    ).run(ids);
  };

  batchMultiVarQuery(db, id, removeByIdsSync);
}

export function removeAllFromTable(db: Database, table: TableType): void {
  db.prepare<EmptyQuery>(`DELETE FROM ${table};`).run();
}

export function getAllFromTable<T>(db: Database, table: TableType): Array<T> {
  const rows: JSONRows = db
    .prepare<EmptyQuery>(`SELECT json FROM ${table};`)
    .all();

  return rows.map(row => jsonToObject(row.json));
}

export function getCountFromTable(db: Database, table: TableType): number {
  const result: null | number = db
    .prepare<EmptyQuery>(`SELECT count(*) from ${table};`)
    .pluck(true)
    .get();
  if (isNumber(result)) {
    return result;
  }
  throw new Error(`getCountFromTable: Unable to get count from table ${table}`);
}

export class TableIterator<ObjectType extends { id: string }> {
  constructor(
    private readonly db: Database,
    private readonly table: TableType,
    private readonly pageSize = 500
  ) {}

  *[Symbol.iterator](): Iterator<ObjectType> {
    const fetchObject = this.db.prepare<Query>(
      `
        SELECT json FROM ${this.table}
        WHERE id > $id
        ORDER BY id ASC
        LIMIT $pageSize;
      `
    );

    let complete = false;
    let id = '';
    while (!complete) {
      const rows: JSONRows = fetchObject.all({
        id,
        pageSize: this.pageSize,
      });

      const messages: Array<ObjectType> = rows.map(row =>
        jsonToObject(row.json)
      );
      yield* messages;

      const lastMessage: ObjectType | undefined = last(messages);
      if (lastMessage) {
        ({ id } = lastMessage);
      }
      complete = messages.length < this.pageSize;
    }
  }
}

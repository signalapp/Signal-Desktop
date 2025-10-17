// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable max-classes-per-file */

import lodash from 'lodash';

import type { ReadableDB, WritableDB } from './Interface.std.js';
import type { LoggerType } from '../types/Logging.std.js';

const { isNumber, last } = lodash;

export type JSONRow = Readonly<{ json: string }>;
export type JSONRows = Array<JSONRow>;

export type TableType =
  | 'attachment_downloads'
  | 'conversations'
  | 'identityKeys'
  | 'items'
  | 'kyberPreKeys'
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

export type QueryTemplateParam = Uint8Array | string | number | null;
export type QueryFragmentValue = QueryFragment | QueryTemplateParam;

export class QueryFragment {
  constructor(
    public readonly fragment: string,
    public readonly fragmentParams: ReadonlyArray<QueryTemplateParam>
  ) {}
}

/**
 * You can use tagged template literals to build "fragments" of SQL queries
 *
 * ```ts
 * const [query, params] = sql`
 *   SELECT * FROM examples
 *   WHERE groupId = ${groupId}
 *   ORDER BY timestamp ${asc ? sqlFragment`ASC` : sqlFragment`DESC`}
 * `;
 * ```
 *
 * SQL Fragments can contain other SQL fragments, but must be finalized with
 * `sql` before being passed to `Database#prepare`.
 *
 * The name `sqlFragment` comes from several editors that support SQL syntax
 * highlighting inside JavaScript template literals.
 */
export function sqlFragment(
  strings: TemplateStringsArray,
  ...values: ReadonlyArray<QueryFragmentValue>
): QueryFragment {
  let query = '';
  const params: Array<QueryTemplateParam> = [];

  strings.forEach((string, index) => {
    const value = values[index];

    query += string;

    if (index < values.length) {
      if (value instanceof QueryFragment) {
        const { fragment, fragmentParams } = value;
        query += fragment;
        params.push(...fragmentParams);
      } else {
        query += '?';
        params.push(value);
      }
    }
  });

  return new QueryFragment(query, params);
}

export function sqlConstant(value: QueryTemplateParam): QueryFragment {
  let fragment;
  if (value == null) {
    fragment = 'NULL';
  } else if (typeof value === 'number') {
    fragment = `${value}`;
  } else if (typeof value === 'boolean') {
    fragment = `${value}`;
  } else {
    fragment = `'${value}'`;
  }
  return new QueryFragment(fragment, []);
}

/**
 * Like `Array.prototype.join`, but for SQL fragments.
 */
const SQL_JOIN_SEPARATOR = ',';
export function sqlJoin(
  items: ReadonlyArray<QueryFragmentValue>
): QueryFragment {
  let query = '';
  const params: Array<QueryTemplateParam> = [];

  items.forEach((item, index) => {
    const { fragment, fragmentParams } = sqlFragment`${item}`;
    query += fragment;
    params.push(...fragmentParams);

    if (index < items.length - 1) {
      query += SQL_JOIN_SEPARATOR;
    }
  });

  return new QueryFragment(query, params);
}

export type QueryTemplate = [string, ReadonlyArray<QueryTemplateParam>];

/**
 * You can use tagged template literals to build SQL queries
 * that can be passed to `Database#prepare`.
 *
 * ```ts
 * const [query, params] = sql`
 *   SELECT * FROM examples
 *   WHERE groupId = ${groupId}
 *   ORDER BY timestamp ASC
 * `;
 * db.prepare(query).all(params);
 * ```
 *
 * SQL queries can contain other SQL fragments, but cannot contain other SQL
 * queries.
 *
 * The name `sql` comes from several editors that support SQL syntax
 * highlighting inside JavaScript template literals.
 */
export function sql(
  strings: TemplateStringsArray,
  ...values: Array<QueryFragment | QueryTemplateParam>
): QueryTemplate {
  const { fragment, fragmentParams } = sqlFragment(strings, ...values);
  return [fragment, fragmentParams];
}

/**
 * Returns typed objects of the query plan for the given query.
 *
 *
 * ```ts
 * const [query, params] = sql`
 *   SELECT * FROM examples
 *   WHERE groupId = ${groupId}
 *   ORDER BY timestamp ASC
 * `;
 * log.info('Query plan', explainQueryPlan(db, [query, params]));
 * db.prepare(query).all(params);
 * ```
 */
export function explainQueryPlan(
  db: ReadableDB,
  logger: LoggerType,
  template: QueryTemplate
): QueryTemplate {
  const [query, params] = template;
  const plan = db.prepare(`EXPLAIN QUERY PLAN ${query}`).all<{
    id: string | number;
    parent: string | number;
    detail: string;
  }>(params);
  logger.info('EXPLAIN QUERY PLAN');
  for (const line of query.split('\n')) {
    logger.info(line);
  }
  for (const row of plan) {
    logger.info(`id=${row.id}, parent=${row.parent}, detail=${row.detail}`);
  }
  return [query, params];
}

//
// Database helpers
//

export function getSQLiteVersion(db: ReadableDB): string {
  return (
    db
      .prepare('select sqlite_version() AS sqlite_version', { pluck: true })
      .get<string>() ?? ''
  );
}

export function getSchemaVersion(db: ReadableDB): number {
  return db.pragma('schema_version', { simple: true }) as number;
}

export function setUserVersion(db: WritableDB, version: number): void {
  if (!isNumber(version)) {
    throw new Error(`setUserVersion: version ${version} is not a number`);
  }
  db.pragma(`user_version = ${version}`);
}

export function getUserVersion(db: ReadableDB): number {
  return db.pragma('user_version', { simple: true }) as number;
}

export function getSQLCipherVersion(db: ReadableDB): string | undefined {
  return db.pragma('cipher_version', { simple: true }) as string | undefined;
}

//
// Various table helpers
//

export function batchMultiVarQuery<ValueT>(
  db: ReadableDB,
  values: ReadonlyArray<ValueT>,
  query: (batch: ReadonlyArray<ValueT>, persistent: boolean) => void
): [];
export function batchMultiVarQuery<ValueT, ResultT>(
  db: ReadableDB,
  values: ReadonlyArray<ValueT>,
  query: (batch: ReadonlyArray<ValueT>, persistent: boolean) => Array<ResultT>
): Array<ResultT>;

export function batchMultiVarQuery<ValueT, ResultT>(
  db: ReadableDB,
  values: ReadonlyArray<ValueT>,
  query:
    | ((batch: ReadonlyArray<ValueT>, persistent: boolean) => void)
    | ((batch: ReadonlyArray<ValueT>, persistent: boolean) => Array<ResultT>)
): Array<ResultT> {
  if (values.length > MAX_VARIABLE_COUNT) {
    const result: Array<ResultT> = [];
    db.transaction(() => {
      for (let i = 0; i < values.length; i += MAX_VARIABLE_COUNT) {
        const batch = values.slice(i, i + MAX_VARIABLE_COUNT);
        const batchResult = query(batch, batch.length === MAX_VARIABLE_COUNT);
        if (Array.isArray(batchResult)) {
          result.push(...batchResult);
        }
      }
    })();
    return result;
  }

  const result = query(values, values.length === MAX_VARIABLE_COUNT);
  return Array.isArray(result) ? result : [];
}

export function createOrUpdate<Key extends string | number>(
  db: WritableDB,
  table: TableType,
  data: Record<string, unknown> & { id: Key }
): void {
  const { id } = data;
  if (!id) {
    throw new Error('createOrUpdate: Provided data did not have a truthy id');
  }

  db.prepare(
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
  db: WritableDB,
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
  db: ReadableDB,
  table: TableType,
  id: Key
): Result | undefined {
  const row = db
    .prepare(
      `
      SELECT json
      FROM ${table}
      WHERE id = $id;
      `
    )
    .get<{ json: string }>({
      id,
    });

  if (!row) {
    return undefined;
  }

  return jsonToObject(row.json);
}

export function removeById<Key extends string | number>(
  db: WritableDB,
  tableName: TableType,
  id: Key | Array<Key>
): number {
  const table = sqlConstant(tableName);
  if (!Array.isArray(id)) {
    const [query, params] = sql`
      DELETE FROM ${table}
      WHERE id = ${id};
    `;
    return db.prepare(query).run(params).changes;
  }

  if (!id.length) {
    throw new Error('removeById: No ids to delete!');
  }

  let totalChanges = 0;

  const removeByIdsSync = (
    ids: ReadonlyArray<string | number>,
    persistent: boolean
  ): void => {
    const [query, params] = sql`
      DELETE FROM ${table}
      WHERE id IN (${sqlJoin(ids)});
    `;
    totalChanges += db.prepare(query, { persistent }).run(params).changes;
  };

  batchMultiVarQuery(db, id, removeByIdsSync);

  return totalChanges;
}

export function removeAllFromTable(db: WritableDB, table: TableType): number {
  return db.prepare(`DELETE FROM ${table};`).run().changes;
}

export function getAllFromTable<T>(db: ReadableDB, table: TableType): Array<T> {
  const rows: JSONRows = db.prepare(`SELECT json FROM ${table};`).all();

  return rows.map(row => jsonToObject(row.json));
}

export function getCountFromTable(db: ReadableDB, table: TableType): number {
  const result = db
    .prepare(`SELECT count(*) from ${table};`, {
      pluck: true,
    })
    .get<number>();
  if (isNumber(result)) {
    return result;
  }
  throw new Error(`getCountFromTable: Unable to get count from table ${table}`);
}

export class TableIterator<ObjectType extends { id: string }> {
  constructor(
    private readonly db: ReadableDB,
    private readonly table: TableType,
    private readonly pageSize = 500
  ) {}

  *[Symbol.iterator](): Iterator<ObjectType> {
    const fetchObject = this.db.prepare(
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

export function convertOptionalIntegerToBoolean(
  optionalInteger?: number
): boolean | undefined {
  if (optionalInteger === 1) {
    return true;
  }
  if (optionalInteger === 0) {
    return false;
  }
  return undefined;
}

export function convertOptionalBooleanToInteger(
  optionalBoolean?: boolean
): 1 | 0 | undefined {
  if (optionalBoolean === true) {
    return 1;
  }
  if (optionalBoolean === false) {
    return 0;
  }
  return undefined;
}

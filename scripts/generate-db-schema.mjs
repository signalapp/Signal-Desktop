// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import * as SqlFormatter from 'sql-formatter';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs, styleText } from 'node:util';
import { assert } from './utils/assert.mjs';

const IS_CI = process.env.CI != null;

const { values: args } = parseArgs({
  options: {
    check: { type: 'boolean', default: false },
  },
});

if (IS_CI && !args.check) {
  console.log('Skipping `pnpm build:db-schema` in CI without --check.');
  process.exit(0);
}

const { createDB, updateToVersion } =
  // oxlint-disable-next-line signal-desktop/no-restricted-paths
  await import('../ts/test-node/sql/helpers.node.ts');
// oxlint-disable-next-line signal-desktop/no-restricted-paths
const { SCHEMA_VERSIONS } = await import('../ts/sql/migrations/index.node.ts');
/** @import { Database } from '@signalapp/sqlcipher' */

const REPO_ROOT = join(import.meta.dirname, '..');

const MAX_DB_SCHEMA_VERSION = SCHEMA_VERSIONS.at(-1)?.version;
assert(MAX_DB_SCHEMA_VERSION != null, 'Missing MAX_DB_SCHEMA_VERSION');

/**
 * @param {Database} db
 * @returns {number}
 */
function getSqlUserVersion(db) {
  return /** @type {any} */ (db.pragma('user_version', { simple: true }));
}

/**
 * @typedef {{
 *   type: 'table' | 'index' | 'trigger';
 *   name: string;
 *   tbl_name: string;
 *   rootpage: number;
 *   sql: string | null;
 * }} SqlEntity
 */

/**
 * @param {Database} db
 * @returns {ReadonlyArray<SqlEntity>}
 */
function getSqlEntities(db) {
  return db.prepare('SELECT * FROM sqlite_schema').all();
}

/**
 * @typedef {{
 *   cid: number;
 *   name: string;
 *   type: string;
 *   notnull: 0 | 1
 *   dflt_value: string | null;
 *   pk: number;
 *   hidden: 0 | 1 | 2 | 3;
 * }} SqlTableColumn
 */

/**
 * @param {Database} db
 * @param {string} tableName
 * @returns {ReadonlyArray<SqlTableColumn>}
 */
function getSqlTableColumns(db, tableName) {
  return /** @type {any} */ (db.pragma(`table_xinfo(${tableName})`));
}

/**
 * @typedef {{
 *   name: string;
 *   seq: number;
 *   unique: 0 | 1;
 *   origin: unknown;
 *   partial: 0 | 1;
 * }} SqlIndex
 */

/**
 * @param {Database} db
 * @param {string} tableName
 * @returns {ReadonlyArray<SqlIndex>}
 */
function getSqlTableIndexes(db, tableName) {
  return /** @type {any} */ (db.pragma(`index_list(${tableName})`));
}

/**
 * @typedef {{
 *   seqno: number;
 *   cid: -1 | 0;
 *   name: string | null;
 *   desc: 0 | 1,
 *   coll: 'BINARY',
 *   key: 0 | 1,
 * }} SqlIndexColumn
 */

/**
 * @param {Database} db
 * @param {string} indexName
 * @returns {ReadonlyArray<SqlIndexColumn>}
 */
function getSqlIndexColumns(db, indexName) {
  return /** @type {any} */ (db.pragma(`index_xinfo(${indexName})`));
}

/**
 * @param {string | null} sql
 * @returns {string | null}
 */
function sqlFormat(sql) {
  if (sql == null) {
    return null;
  }

  return SqlFormatter.format(sql, {
    language: 'sqlite',
    useTabs: false,
    tabWidth: 2,
    expressionWidth: 20,
    linesBetweenQueries: 1,
  });
}

/**
 * @typedef {{
 *   name: string;
 *   type: string | null;
 *   hidden: 'normal' | 'virtual' | 'dynamic' | 'stored';
 *   nullable: boolean;
 *   defaultValue: string | null;
 * }} SchemaTableColumn
 */

/** @type {Record<SqlTableColumn['hidden'], SchemaTableColumn['hidden']>} */
const TABLE_HIDDEN_MAP = {
  0: 'normal',
  1: 'virtual',
  2: 'dynamic',
  3: 'stored',
};

/**
 * @param {SqlTableColumn} column
 * @returns {SchemaTableColumn}
 */
function getSchemaTableColumn(column) {
  return {
    name: column.name,
    type: column.type !== '' ? column.type : null,
    hidden: TABLE_HIDDEN_MAP[column.hidden],
    nullable: column.notnull === 0,
    defaultValue: column.dflt_value,
  };
}

/**
 * @typedef {{
 *   name: string | null;
 *   indexRank: number;
 *   tableRank: 'expression' | 'rowid' | number;
 *   sortOrder: 'asc' | 'desc';
 *   collatingSequenceName: string;
 *   isKey: boolean;
 * }} SchemaIndexColumn
 */

/**
 * @param {number} tableRank
 * @returns {SchemaIndexColumn['tableRank']}
 */
function getSchemaIndexColumnTableRank(tableRank) {
  if (tableRank === -1) {
    return 'expression';
  }
  if (tableRank === -2) {
    return 'rowid';
  }
  return tableRank; /* 0...N */
}

/**
 * @param {SqlIndexColumn} indexColumn
 * @returns {SchemaIndexColumn}
 */
function getSchemaIndexColumn(indexColumn) {
  return {
    indexRank: indexColumn.seqno,
    tableRank: getSchemaIndexColumnTableRank(indexColumn.cid),
    name: indexColumn.name,
    sortOrder: indexColumn.desc === 1 ? 'desc' : 'asc',
    collatingSequenceName: indexColumn.coll,
    isKey: indexColumn.key === 1,
  };
}

/**
 * @typedef {{
 *   name: string;
 *   sql: string | null;
 *   unique: boolean;
 *   partial: boolean;
 *   columns: ReadonlyArray<SchemaIndexColumn>;
 * }} SchemaIndex
 */

/**
 * @param {SqlIndex} index
 * @param {SqlEntity | null} indexEntity
 * @returns {SchemaIndex}
 */
function getSchemaIndex(index, indexEntity) {
  const indexColumns = getSqlIndexColumns(db, index.name);
  return {
    name: index.name,
    sql: sqlFormat(indexEntity?.sql ?? null),
    unique: index.unique === 1,
    partial: index.partial === 1,
    columns: indexColumns.map(indexColumn => {
      return getSchemaIndexColumn(indexColumn);
    }),
  };
}

/**
 * @typedef {{
 *   name: string;
 *   sql: string | null;
 * }} SchemaTrigger
 */

/**
 * @param {SqlEntity} triggerEntity
 * @returns {SchemaTrigger}
 */
function getSchemaTrigger(triggerEntity) {
  return {
    name: triggerEntity.name,
    sql: sqlFormat(triggerEntity.sql),
  };
}

/**
 * @typedef {{
 *   name: string;
 *   sql: string | null;
 *   columns: ReadonlyArray<SchemaTableColumn>;
 *   indexes: ReadonlyArray<SchemaIndex>;
 *   triggers: ReadonlyArray<SchemaTrigger>;
 * }} SchemaTable
 */

/**
 * @typedef {{
 *   userVersion: number;
 *   tables: ReadonlyArray<SchemaTable>;
 * }} Schema
 */

/**
 * @param {Database} db
 * @returns {Schema}
 */
function getSchema(db) {
  const userVersion = getSqlUserVersion(db);
  const entities = getSqlEntities(db).toSorted((a, b) => {
    return a.name.localeCompare(b.name);
  });

  const tableEntities = entities.filter(entity => entity.type === 'table');
  const indexEntities = entities.filter(entity => entity.type === 'index');
  const triggerEntities = entities.filter(entity => entity.type === 'trigger');

  const indexEntityByName = new Map(
    indexEntities.map(index => [index.name, index])
  );
  const triggerEntitiesByTable = Map.groupBy(
    triggerEntities,
    entity => entity.tbl_name
  );

  /**
   * @param {SqlEntity} tableEntity
   * @returns {SchemaTable}
   */
  function getSchemaTable(tableEntity) {
    const tableColumns = getSqlTableColumns(db, tableEntity.name);
    const tableIndexes = getSqlTableIndexes(db, tableEntity.name).toSorted(
      (a, b) => {
        return a.name.localeCompare(b.name);
      }
    );
    const tableTriggerEntities =
      triggerEntitiesByTable.get(tableEntity.name) ?? [];

    return {
      name: tableEntity.name,
      sql: sqlFormat(tableEntity.sql),
      columns: tableColumns.map(tableColumn => {
        return getSchemaTableColumn(tableColumn);
      }),
      indexes: tableIndexes.map(tableIndex => {
        const indexEntity = indexEntityByName.get(tableIndex.name) ?? null;
        return getSchemaIndex(tableIndex, indexEntity);
      }),
      triggers: tableTriggerEntities.map(triggerEntity => {
        return getSchemaTrigger(triggerEntity);
      }),
    };
  }

  return {
    userVersion,
    tables: tableEntities.map(tableEntity => {
      return getSchemaTable(tableEntity);
    }),
  };
}

/**
 * @param {string} lang
 * @param {string} code
 * @returns {string}
 */
function printCodeBlock(lang, code) {
  let res = '';
  res += `\`\`\`${lang}\n`;
  res += code;
  res += '\n';
  res += '```\n';
  return res;
}

/**
 * @param {string} summary
 * @param {string} contents
 * @returns {string}
 */
function printDetails(summary, contents) {
  let res = '';
  res += '<details>\n';
  if (summary.includes('\n')) {
    res += '<summary>\n';
    res += '\n';
    res += summary;
    res += '\n';
    res += '</summary>\n';
  } else {
    res += `<summary>${summary}</summary>\n`;
  }
  res += '\n';
  res += contents;
  res += '\n';
  res += '</details>\n';
  return res;
}

/**
 * @template T
 * @param {ReadonlyArray<T>} sections
 * @param {(section: T) => string} printer
 * @returns {string}
 */
function printSections(sections, printer) {
  let res = '';
  for (const [i, section] of sections.entries()) {
    if (i !== 0) {
      res += '\n';
    }
    res += printer(section);
  }
  return res;
}

/**
 * @param {SchemaIndex} index
 * @returns {string}
 */
function printSchemaIndex(index) {
  let res = '';
  if (index.sql != null) {
    res += printCodeBlock('sql', index.sql);
  } else {
    res += printCodeBlock('text', '(404: SQL Not Found)');
  }
  return res;
}

/**
 * @param {SchemaTrigger} trigger
 * @returns {string}
 */
function printSchemaTrigger(trigger) {
  let res = '';
  if (trigger.sql != null) {
    res += printCodeBlock('sql', trigger.sql);
  } else {
    res += printCodeBlock('text', '(404: SQL Not Found)');
  }
  return res;
}

/**
 * @param {SchemaTable} table
 * @returns {string}
 */
function printSchemaTable(table) {
  let res = '';
  if (table.sql != null) {
    res += printCodeBlock('sql', table.sql);
  } else {
    res += printCodeBlock('text', '404: SQL Not Found');
  }
  if (table.indexes.length !== 0) {
    res += '\n';
    res += printSections(table.indexes, index => {
      return printDetails(
        `Index: ${table.name} → ${index.name}`,
        printSchemaIndex(index)
      );
    });
  }
  if (table.triggers.length !== 0) {
    res += '\n';
    res += printSections(table.triggers, trigger => {
      return printDetails(
        `Trigger: ${table.name} → ${trigger.name}`,
        printSchemaTrigger(trigger)
      );
    });
  }

  res += '\n';
  res += '---\n';

  return printDetails(`Table: ${table.name}`, res);
}

/**
 * @param {Schema} schema
 * @returns {string}
 */
function printSchema(schema) {
  let res = '';

  res += '<!-- Copyright 2026 Signal Messenger, LLC -->\n';
  res += '<!-- SPDX-License-Identifier: AGPL-3.0-only -->\n';
  res += '\n';
  res += '# Database Schema\n';
  res += '\n';
  res += printSections(schema.tables, table => {
    return printSchemaTable(table);
  });

  return res;
}

const db = createDB();
updateToVersion(db, MAX_DB_SCHEMA_VERSION);
const schema = getSchema(db);

const fileName = 'DATABASE_SCHEMA.md';
const filePath = join(REPO_ROOT, fileName);
const fileContents = printSchema(schema);

/** @type {string | null} */
let current;
try {
  current = await readFile(filePath, 'utf8');
} catch {
  current = null;
}

if (current === fileContents) {
  console.log(styleText('dim', `${fileName} was unchanged.\n`));
  process.exit(0);
}

if (args.check) {
  if (IS_CI) {
    console.log(
      `::error file=${fileName}::${fileName} is out of date, run \`pnpm build:db-schema\` to update.`
    );
  } else {
    console.log(
      styleText(
        'red',
        `${fileName} is out of date, run ${styleText('magenta', '`pnpm build:db-schema`')} to update.\n`
      )
    );
  }
  process.exit(1);
}

await writeFile(filePath, fileContents);
console.log(styleText('green', `${fileName} was updated.\n`));

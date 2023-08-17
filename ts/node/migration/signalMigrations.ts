import path from 'path';
import * as BetterSqlite3 from '@signalapp/better-sqlite3';
import { isNumber } from 'lodash';

import {
  ATTACHMENT_DOWNLOADS_TABLE,
  CONVERSATIONS_TABLE,
  HEX_KEY,
  IDENTITY_KEYS_TABLE,
  ITEMS_TABLE,
  LAST_HASHES_TABLE,
  MESSAGES_FTS_TABLE,
  MESSAGES_TABLE,
} from '../database_utility';
import { getAppRootPath } from '../getRootPath';
import { updateSessionSchema } from './sessionMigrations';

// eslint:disable: quotemark non-literal-fs-path one-variable-per-declaration
const openDbOptions = {
  // eslint-disable-next-line no-constant-condition
  verbose: false ? console.log : undefined,

  nativeBinding: path.join(
    getAppRootPath(),
    'node_modules',
    '@signalapp',
    'better-sqlite3',
    'build',
    'Release',
    'better_sqlite3.node'
  ),
};

// eslint:disable: one-variable-per-declaration

function updateToSchemaVersion1(currentVersion: number, db: BetterSqlite3.Database) {
  if (currentVersion >= 1) {
    return;
  }

  console.log('updateToSchemaVersion1: starting...');

  db.transaction(() => {
    db.exec(
      `CREATE TABLE ${MESSAGES_TABLE}(
        id STRING PRIMARY KEY ASC,
        json TEXT,

        unread INTEGER,
        expires_at INTEGER,
        sent BOOLEAN,
        sent_at INTEGER,
        schemaVersion INTEGER,
        conversationId STRING,
        received_at INTEGER,
        source STRING,
        sourceDevice STRING,
        hasAttachments INTEGER,
        hasFileAttachments INTEGER,
        hasVisualMediaAttachments INTEGER
      );

      CREATE INDEX messages_unread ON ${MESSAGES_TABLE} (
        unread
      );

      CREATE INDEX messages_expires_at ON ${MESSAGES_TABLE} (
        expires_at
      );

      CREATE INDEX messages_receipt ON ${MESSAGES_TABLE} (
        sent_at
      );

      CREATE INDEX messages_schemaVersion ON ${MESSAGES_TABLE} (
        schemaVersion
      );

      CREATE INDEX messages_conversation ON ${MESSAGES_TABLE} (
        conversationId,
        received_at
      );

      CREATE INDEX messages_duplicate_check ON ${MESSAGES_TABLE} (
        source,
        sourceDevice,
        sent_at
      );

      CREATE INDEX messages_hasAttachments ON ${MESSAGES_TABLE} (
        conversationId,
        hasAttachments,
        received_at
      );

      CREATE INDEX messages_hasFileAttachments ON ${MESSAGES_TABLE} (
        conversationId,
        hasFileAttachments,
        received_at
      );

      CREATE INDEX messages_hasVisualMediaAttachments ON ${MESSAGES_TABLE} (
        conversationId,
        hasVisualMediaAttachments,
        received_at
      );

      CREATE TABLE unprocessed(
        id STRING,
        timestamp INTEGER,
        json TEXT
      );

      CREATE INDEX unprocessed_id ON unprocessed (
        id
      );

      CREATE INDEX unprocessed_timestamp ON unprocessed (
        timestamp
      );


      `
    );
    db.pragma('user_version = 1');
  })();

  console.log('updateToSchemaVersion1: success!');
}

function updateToSchemaVersion2(currentVersion: number, db: BetterSqlite3.Database) {
  if (currentVersion >= 2) {
    return;
  }

  console.log('updateToSchemaVersion2: starting...');

  db.transaction(() => {
    db.exec(`ALTER TABLE ${MESSAGES_TABLE}
       ADD COLUMN expireTimer INTEGER;

       ALTER TABLE ${MESSAGES_TABLE}
       ADD COLUMN expirationStartTimestamp INTEGER;

       ALTER TABLE ${MESSAGES_TABLE}
       ADD COLUMN type STRING;

       CREATE INDEX messages_expiring ON ${MESSAGES_TABLE} (
        expireTimer,
        expirationStartTimestamp,
        expires_at
      );

      UPDATE ${MESSAGES_TABLE} SET
        expirationStartTimestamp = json_extract(json, '$.expirationStartTimestamp'),
        expireTimer = json_extract(json, '$.expireTimer'),
        type = json_extract(json, '$.type');


       `);
    db.pragma('user_version = 2');
  })();

  console.log('updateToSchemaVersion2: success!');
}

function updateToSchemaVersion3(currentVersion: number, db: BetterSqlite3.Database) {
  if (currentVersion >= 3) {
    return;
  }

  console.log('updateToSchemaVersion3: starting...');

  db.transaction(() => {
    db.exec(`
      DROP INDEX messages_expiring;
      DROP INDEX messages_unread;

      CREATE INDEX messages_without_timer ON ${MESSAGES_TABLE} (
        expireTimer,
        expires_at,
        type
      ) WHERE expires_at IS NULL AND expireTimer IS NOT NULL;

      CREATE INDEX messages_unread ON ${MESSAGES_TABLE} (
        conversationId,
        unread
      ) WHERE unread IS NOT NULL;

      ANALYZE;

      `);
    db.pragma('user_version = 3');
  })();

  console.log('updateToSchemaVersion3: success!');
}

function updateToSchemaVersion4(currentVersion: number, db: BetterSqlite3.Database) {
  if (currentVersion >= 4) {
    return;
  }

  console.log('updateToSchemaVersion4: starting...');

  db.transaction(() => {
    db.exec(`

      CREATE TABLE ${CONVERSATIONS_TABLE}(
        id STRING PRIMARY KEY ASC,
        json TEXT,

        active_at INTEGER,
        type STRING,
        members TEXT,
        name TEXT,
        profileName TEXT
      );

      CREATE INDEX conversations_active ON ${CONVERSATIONS_TABLE} (
        active_at
      ) WHERE active_at IS NOT NULL;
      CREATE INDEX conversations_type ON ${CONVERSATIONS_TABLE} (
        type
      ) WHERE type IS NOT NULL;

      `);

    db.pragma('user_version = 4');
  })();

  console.log('updateToSchemaVersion4: success!');
}

function updateToSchemaVersion6(currentVersion: number, db: BetterSqlite3.Database) {
  if (currentVersion >= 6) {
    return;
  }
  console.log('updateToSchemaVersion6: starting...');
  db.transaction(() => {
    db.exec(`
      CREATE TABLE ${LAST_HASHES_TABLE}(
        snode TEXT PRIMARY KEY,
        hash TEXT,
        expiresAt INTEGER
      );

      CREATE TABLE seenMessages(
        hash TEXT PRIMARY KEY,
        expiresAt INTEGER
      );


      CREATE TABLE sessions(
        id STRING PRIMARY KEY ASC,
        number STRING,
        json TEXT
      );

      CREATE INDEX sessions_number ON sessions (
        number
      ) WHERE number IS NOT NULL;

      CREATE TABLE groups(
        id STRING PRIMARY KEY ASC,
        json TEXT
      );


      CREATE TABLE ${IDENTITY_KEYS_TABLE}(
        id STRING PRIMARY KEY ASC,
        json TEXT
      );

      CREATE TABLE ${ITEMS_TABLE}(
        id STRING PRIMARY KEY ASC,
        json TEXT
      );


      CREATE TABLE preKeys(
        id INTEGER PRIMARY KEY ASC,
        recipient STRING,
        json TEXT
      );


      CREATE TABLE signedPreKeys(
        id INTEGER PRIMARY KEY ASC,
        json TEXT
      );

      CREATE TABLE contactPreKeys(
        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        identityKeyString VARCHAR(255),
        keyId INTEGER,
        json TEXT
      );

      CREATE UNIQUE INDEX contact_prekey_identity_key_string_keyid ON contactPreKeys (
        identityKeyString,
        keyId
      );

      CREATE TABLE contactSignedPreKeys(
        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        identityKeyString VARCHAR(255),
        keyId INTEGER,
        json TEXT
      );

      CREATE UNIQUE INDEX contact_signed_prekey_identity_key_string_keyid ON contactSignedPreKeys (
        identityKeyString,
        keyId
      );

      `);
    db.pragma('user_version = 6');
  })();

  console.log('updateToSchemaVersion6: success!');
}

function updateToSchemaVersion7(currentVersion: number, db: BetterSqlite3.Database) {
  if (currentVersion >= 7) {
    return;
  }
  console.log('updateToSchemaVersion7: starting...');

  db.transaction(() => {
    db.exec(`
        -- SQLite has been coercing our STRINGs into numbers, so we force it with TEXT
        -- We create a new table then copy the data into it, since we can't modify columns
        DROP INDEX sessions_number;
        ALTER TABLE sessions RENAME TO sessions_old;

        CREATE TABLE sessions(
          id TEXT PRIMARY KEY,
          number TEXT,
          json TEXT
        );
        CREATE INDEX sessions_number ON sessions (
          number
        ) WHERE number IS NOT NULL;
        INSERT INTO sessions(id, number, json)
      SELECT id, number, json FROM sessions_old;
        DROP TABLE sessions_old;
      `);

    db.pragma('user_version = 7');
  })();

  console.log('updateToSchemaVersion7: success!');
}

function updateToSchemaVersion8(currentVersion: number, db: BetterSqlite3.Database) {
  if (currentVersion >= 8) {
    return;
  }
  console.log('updateToSchemaVersion8: starting...');

  db.transaction(() => {
    db.exec(`
      -- First, we pull a new body field out of the message table's json blob
      ALTER TABLE ${MESSAGES_TABLE}
        ADD COLUMN body TEXT;
      UPDATE ${MESSAGES_TABLE} SET body = json_extract(json, '$.body');

      -- Then we create our full-text search table and populate it
      CREATE VIRTUAL TABLE ${MESSAGES_FTS_TABLE}
        USING fts5(id UNINDEXED, body);

      INSERT INTO ${MESSAGES_FTS_TABLE}(id, body)
        SELECT id, body FROM ${MESSAGES_TABLE};

      -- Then we set up triggers to keep the full-text search table up to date
      CREATE TRIGGER messages_on_insert AFTER INSERT ON ${MESSAGES_TABLE} BEGIN
        INSERT INTO ${MESSAGES_FTS_TABLE} (
          id,
          body
        ) VALUES (
          new.id,
          new.body
        );
      END;
      CREATE TRIGGER messages_on_delete AFTER DELETE ON ${MESSAGES_TABLE} BEGIN
        DELETE FROM ${MESSAGES_FTS_TABLE} WHERE id = old.id;
      END;
      CREATE TRIGGER messages_on_update AFTER UPDATE ON ${MESSAGES_TABLE} BEGIN
        DELETE FROM ${MESSAGES_FTS_TABLE} WHERE id = old.id;
        INSERT INTO ${MESSAGES_FTS_TABLE}(
          id,
          body
        ) VALUES (
          new.id,
          new.body
        );
      END;

      `);
    // For formatting search results:
    //   https://sqlite.org/fts5.html#the_highlight_function
    //   https://sqlite.org/fts5.html#the_snippet_function
    db.pragma('user_version = 8');
  })();

  console.log('updateToSchemaVersion8: success!');
}

function updateToSchemaVersion9(currentVersion: number, db: BetterSqlite3.Database) {
  if (currentVersion >= 9) {
    return;
  }
  console.log('updateToSchemaVersion9: starting...');
  db.transaction(() => {
    db.exec(`
        CREATE TABLE ${ATTACHMENT_DOWNLOADS_TABLE}(
          id STRING primary key,
          timestamp INTEGER,
          pending INTEGER,
          json TEXT
        );

        CREATE INDEX attachment_downloads_timestamp
          ON ${ATTACHMENT_DOWNLOADS_TABLE} (
            timestamp
        ) WHERE pending = 0;
        CREATE INDEX attachment_downloads_pending
          ON ${ATTACHMENT_DOWNLOADS_TABLE} (
            pending
        ) WHERE pending != 0;
      `);

    db.pragma('user_version = 9');
  })();

  console.log('updateToSchemaVersion9: success!');
}

function updateToSchemaVersion10(currentVersion: number, db: BetterSqlite3.Database) {
  if (currentVersion >= 10) {
    return;
  }
  console.log('updateToSchemaVersion10: starting...');

  db.transaction(() => {
    db.exec(`
        DROP INDEX unprocessed_id;
        DROP INDEX unprocessed_timestamp;
        ALTER TABLE unprocessed RENAME TO unprocessed_old;

        CREATE TABLE unprocessed(
          id STRING,
          timestamp INTEGER,
          version INTEGER,
          attempts INTEGER,
          envelope TEXT,
          decrypted TEXT,
          source TEXT,
          sourceDevice TEXT,
          serverTimestamp INTEGER
        );

        CREATE INDEX unprocessed_id ON unprocessed (
          id
        );
        CREATE INDEX unprocessed_timestamp ON unprocessed (
          timestamp
        );

        INSERT INTO unprocessed (
          id,
          timestamp,
          version,
          attempts,
          envelope,
          decrypted,
          source,
          sourceDevice,
          serverTimestamp
        ) SELECT
          id,
          timestamp,
          json_extract(json, '$.version'),
          json_extract(json, '$.attempts'),
          json_extract(json, '$.envelope'),
          json_extract(json, '$.decrypted'),
          json_extract(json, '$.source'),
          json_extract(json, '$.sourceDevice'),
          json_extract(json, '$.serverTimestamp')
        FROM unprocessed_old;

        DROP TABLE unprocessed_old;
      `);

    db.pragma('user_version = 10');
  })();
  console.log('updateToSchemaVersion10: success!');
}

function updateToSchemaVersion11(currentVersion: number, db: BetterSqlite3.Database) {
  if (currentVersion >= 11) {
    return;
  }
  console.log('updateToSchemaVersion11: starting...');
  db.transaction(() => {
    db.exec(`
        DROP TABLE groups;
      `);

    db.pragma('user_version = 11');
  })();
  console.log('updateToSchemaVersion11: success!');
}

const SCHEMA_VERSIONS = [
  updateToSchemaVersion1,
  updateToSchemaVersion2,
  updateToSchemaVersion3,
  updateToSchemaVersion4,
  () => null, // version 5 was dropped
  updateToSchemaVersion6,
  updateToSchemaVersion7,
  updateToSchemaVersion8,
  updateToSchemaVersion9,
  updateToSchemaVersion10,
  updateToSchemaVersion11,
];

export async function updateSchema(db: BetterSqlite3.Database) {
  const sqliteVersion = getSQLiteVersion(db);
  const sqlcipherVersion = getSQLCipherVersion(db);
  const userVersion = getUserVersion(db);
  const maxUserVersion = SCHEMA_VERSIONS.length;
  const schemaVersion = getSchemaVersion(db);

  console.log('updateSchema:');
  console.log(` Current user_version: ${userVersion}`);
  console.log(` Most recent db schema: ${maxUserVersion}`);
  console.log(` SQLite version: ${sqliteVersion}`);
  console.log(` SQLCipher version: ${sqlcipherVersion}`);
  console.log(` (deprecated) schema_version: ${schemaVersion}`);

  for (let index = 0, max = SCHEMA_VERSIONS.length; index < max; index += 1) {
    const runSchemaUpdate = SCHEMA_VERSIONS[index];
    runSchemaUpdate(schemaVersion, db);
  }
  await updateSessionSchema(db);
}

function migrateSchemaVersion(db: BetterSqlite3.Database) {
  const userVersion = getUserVersion(db);
  if (userVersion > 0) {
    return;
  }
  const schemaVersion = getSchemaVersion(db);

  const newUserVersion = schemaVersion > 18 ? 16 : schemaVersion;
  console.log(
    'migrateSchemaVersion: Migrating from schema_version ' +
      `${schemaVersion} to user_version ${newUserVersion}`
  );

  setUserVersion(db, newUserVersion);
}

function getUserVersion(db: BetterSqlite3.Database) {
  try {
    return db.pragma('user_version', { simple: true });
  } catch (e) {
    console.error('getUserVersion error', e);
    return 0;
  }
}

function setUserVersion(db: BetterSqlite3.Database, version: number) {
  if (!isNumber(version)) {
    throw new Error(`setUserVersion: version ${version} is not a number`);
  }

  db.pragma(`user_version = ${version}`);
}

export function openAndMigrateDatabase(filePath: string, key: string) {
  let db;

  // First, we try to open the database without any cipher changes
  try {
    // eslint-disable-next-line new-cap
    db = new (BetterSqlite3 as any).default(filePath, openDbOptions);

    keyDatabase(db, key);
    switchToWAL(db);
    migrateSchemaVersion(db);
    db.pragma('secure_delete = ON');

    return db;
  } catch (error) {
    if (db) {
      db.close();
    }
    console.log('migrateDatabase: Migration without cipher change failed', error.message);
  }

  // If that fails, we try to open the database with 3.x compatibility to extract the
  //   user_version (previously stored in schema_version, blown away by cipher_migrate).

  let db1;
  try {
    // eslint-disable-next-line new-cap
    db1 = new (BetterSqlite3 as any).default(filePath, openDbOptions);
    keyDatabase(db1, key);

    // https://www.zetetic.net/blog/2018/11/30/sqlcipher-400-release/#compatability-sqlcipher-4-0-0
    db1.pragma('cipher_compatibility = 3');
    migrateSchemaVersion(db1);
    db1.close();
  } catch (error) {
    if (db1) {
      db1.close();
    }
    console.log('migrateDatabase: migrateSchemaVersion failed', error);
    return null;
  }
  // After migrating user_version -> schema_version, we reopen database, because we can't
  //   migrate to the latest ciphers after we've modified the defaults.
  let db2;
  try {
    // eslint-disable-next-line new-cap
    db2 = new (BetterSqlite3 as any).default(filePath, openDbOptions);
    keyDatabase(db2, key);

    db2.pragma('cipher_migrate');
    switchToWAL(db2);

    // Because foreign key support is not enabled by default!
    db2.pragma('foreign_keys = OFF');

    return db2;
  } catch (error) {
    if (db2) {
      db2.close();
    }
    console.log('migrateDatabase: switchToWAL failed');
    return null;
  }
}

function getSQLiteVersion(db: BetterSqlite3.Database) {
  const { sqlite_version } = db.prepare('select sqlite_version() as sqlite_version').get();
  return sqlite_version;
}

function getSchemaVersion(db: BetterSqlite3.Database) {
  return db.pragma('schema_version', { simple: true });
}

function getSQLCipherVersion(db: BetterSqlite3.Database) {
  return db.pragma('cipher_version', { simple: true });
}

export function getSQLCipherIntegrityCheck(db: BetterSqlite3.Database) {
  const rows = db.pragma('cipher_integrity_check');
  if (rows.length === 0) {
    return undefined;
  }
  return rows.map((row: any) => row.cipher_integrity_check);
}

function keyDatabase(db: BetterSqlite3.Database, key: string) {
  // https://www.zetetic.net/sqlcipher/sqlcipher-api/#key
  // If the password isn't hex then we need to derive a key from it

  const deriveKey = HEX_KEY.test(key);

  const value = deriveKey ? `'${key}'` : `"x'${key}'"`;

  const pragramToRun = `key = ${value}`;

  db.pragma(pragramToRun);
}

function switchToWAL(db: BetterSqlite3.Database) {
  // https://sqlite.org/wal.html
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = FULL');
}

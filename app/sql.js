const path = require('path');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const sql = require('@journeyapps/sqlcipher');
const { app, dialog, clipboard } = require('electron');
const { redactAll } = require('../js/modules/privacy');
const { remove: removeUserConfig } = require('./user_config');

const pify = require('pify');
const {
  map,
  isString,
  fromPairs,
  forEach,
  last,
  isEmpty,
  isObject,
} = require('lodash');

// To get long stack traces
//   https://github.com/mapbox/node-sqlite3/wiki/API#sqlite3verbose
sql.verbose();

module.exports = {
  initialize,
  close,
  removeDB,
  setSQLPassword,

  getPasswordHash,
  savePasswordHash,
  removePasswordHash,

  getIdentityKeyById,

  removeAllSignedPreKeys,
  removeAllContactPreKeys,
  removeAllContactSignedPreKeys,
  removeAllPreKeys,
  removeAllSessions,

  createOrUpdateItem,
  getItemById,
  getAllItems,
  removeItemById,

  getSwarmNodesForPubkey,
  updateSwarmNodesForPubkey,
  getGuardNodes,
  updateGuardNodes,

  getConversationCount,
  saveConversation,
  getConversationById,
  savePublicServerToken,
  getPublicServerTokenByServerUrl,
  updateConversation,
  removeConversation,
  getAllConversations,
  getAllPublicConversations,
  getPubkeysInPublicConversation,
  getAllConversationIds,
  getAllGroupsInvolvingId,
  removeAllConversations,

  searchConversations,
  searchMessages,
  searchMessagesInConversation,

  getMessageCount,
  saveMessage,
  cleanSeenMessages,
  cleanLastHashes,
  saveSeenMessageHashes,
  saveSeenMessageHash,
  updateLastHash,
  saveMessages,
  removeMessage,
  getUnreadByConversation,
  getUnreadCountByConversation,
  getMessageBySender,
  getMessageIdsFromServerIds,
  getMessageById,
  getAllMessages,
  getAllMessageIds,
  getMessagesBySentAt,
  getSeenMessagesByHashList,
  getLastHashBySnode,
  getExpiredMessages,
  getOutgoingWithoutExpiresAt,
  getNextExpiringMessage,
  getMessagesByConversation,

  getUnprocessedCount,
  getAllUnprocessed,
  saveUnprocessed,
  updateUnprocessedAttempts,
  updateUnprocessedWithData,
  getUnprocessedById,
  removeUnprocessed,
  removeAllUnprocessed,

  getNextAttachmentDownloadJobs,
  saveAttachmentDownloadJob,
  setAttachmentDownloadJobPending,
  resetAttachmentDownloadPending,
  removeAttachmentDownloadJob,
  removeAllAttachmentDownloadJobs,

  removeAll,

  getMessagesWithVisualMediaAttachments,
  getMessagesWithFileAttachments,

  removeKnownAttachments,

  getAllEncryptionKeyPairsForGroup,
  getLatestClosedGroupEncryptionKeyPair,
  addClosedGroupEncryptionKeyPair,
  isKeyPairAlreadySaved,
  removeAllClosedGroupEncryptionKeyPairs,

  // open group v2
  getV2OpenGroupRoom,
  saveV2OpenGroupRoom,
  getAllV2OpenGroupRooms,
  getV2OpenGroupRoomByRoomId,
  removeV2OpenGroupRoom,
};

function objectToJSON(data) {
  return JSON.stringify(data);
}
function jsonToObject(json) {
  return JSON.parse(json);
}

async function openDatabase(filePath) {
  return new Promise((resolve, reject) => {
    const instance = new sql.Database(filePath, error => {
      if (error) {
        return reject(error);
      }

      return resolve(instance);
    });
  });
}

function promisify(rawInstance) {
  /* eslint-disable no-param-reassign */
  rawInstance.close = pify(rawInstance.close.bind(rawInstance));
  rawInstance.run = pify(rawInstance.run.bind(rawInstance));
  rawInstance.get = pify(rawInstance.get.bind(rawInstance));
  rawInstance.all = pify(rawInstance.all.bind(rawInstance));
  rawInstance.each = pify(rawInstance.each.bind(rawInstance));
  rawInstance.exec = pify(rawInstance.exec.bind(rawInstance));
  rawInstance.prepare = pify(rawInstance.prepare.bind(rawInstance));
  /* eslint-enable */

  return rawInstance;
}

async function getSQLiteVersion(instance) {
  const row = await instance.get('select sqlite_version() AS sqlite_version');
  return row.sqlite_version;
}

async function getSchemaVersion(instance) {
  const row = await instance.get('PRAGMA schema_version;');
  return row.schema_version;
}

async function getSQLCipherVersion(instance) {
  const row = await instance.get('PRAGMA cipher_version;');
  try {
    return row.cipher_version;
  } catch (e) {
    return null;
  }
}

async function getSQLIntegrityCheck(instance) {
  const row = await instance.get('PRAGMA cipher_integrity_check;');
  if (row) {
    return row.cipher_integrity_check;
  }

  return null;
}

const HEX_KEY = /[^0-9A-Fa-f]/;
async function setupSQLCipher(instance, { key }) {
  // If the key isn't hex then we need to derive a hex key from it
  const deriveKey = HEX_KEY.test(key);

  // https://www.zetetic.net/sqlcipher/sqlcipher-api/#key
  const value = deriveKey ? `'${key}'` : `"x'${key}'"`;
  await instance.run(`PRAGMA key = ${value};`);

  // https://www.zetetic.net/blog/2018/11/30/sqlcipher-400-release/#compatability-sqlcipher-4-0-0
  await instance.run('PRAGMA cipher_migrate;');
}

async function setSQLPassword(password) {
  if (!db) {
    throw new Error('setSQLPassword: db is not initialized');
  }

  // If the password isn't hex then we need to derive a key from it
  const deriveKey = HEX_KEY.test(password);
  const value = deriveKey ? `'${password}'` : `"x'${password}'"`;
  await db.run(`PRAGMA rekey = ${value};`);
}

async function updateToSchemaVersion1(currentVersion, instance) {
  if (currentVersion >= 1) {
    return;
  }

  console.log('updateToSchemaVersion1: starting...');

  await instance.run('BEGIN TRANSACTION;');

  await instance.run(
    `CREATE TABLE messages(
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
    );`
  );

  await instance.run(`CREATE INDEX messages_unread ON messages (
      unread
    );`);
  await instance.run(`CREATE INDEX messages_expires_at ON messages (
      expires_at
    );`);
  await instance.run(`CREATE INDEX messages_receipt ON messages (
      sent_at
    );`);
  await instance.run(`CREATE INDEX messages_schemaVersion ON messages (
      schemaVersion
    );`);

  await instance.run(`CREATE INDEX messages_conversation ON messages (
      conversationId,
      received_at
    );`);

  await instance.run(`CREATE INDEX messages_duplicate_check ON messages (
      source,
      sourceDevice,
      sent_at
    );`);
  await instance.run(`CREATE INDEX messages_hasAttachments ON messages (
      conversationId,
      hasAttachments,
      received_at
    );`);
  await instance.run(`CREATE INDEX messages_hasFileAttachments ON messages (
      conversationId,
      hasFileAttachments,
      received_at
    );`);
  await instance.run(`CREATE INDEX messages_hasVisualMediaAttachments ON messages (
      conversationId,
      hasVisualMediaAttachments,
      received_at
    );`);

  await instance.run(`CREATE TABLE unprocessed(
    id STRING,
    timestamp INTEGER,
    json TEXT
  );`);
  await instance.run(`CREATE INDEX unprocessed_id ON unprocessed (
    id
  );`);
  await instance.run(`CREATE INDEX unprocessed_timestamp ON unprocessed (
    timestamp
  );`);

  await instance.run('PRAGMA schema_version = 1;');
  await instance.run('COMMIT TRANSACTION;');

  console.log('updateToSchemaVersion1: success!');
}

async function updateToSchemaVersion2(currentVersion, instance) {
  if (currentVersion >= 2) {
    return;
  }

  console.log('updateToSchemaVersion2: starting...');

  await instance.run('BEGIN TRANSACTION;');

  await instance.run(
    `ALTER TABLE messages
     ADD COLUMN expireTimer INTEGER;`
  );

  await instance.run(
    `ALTER TABLE messages
     ADD COLUMN expirationStartTimestamp INTEGER;`
  );

  await instance.run(
    `ALTER TABLE messages
     ADD COLUMN type STRING;`
  );

  await instance.run(`CREATE INDEX messages_expiring ON messages (
      expireTimer,
      expirationStartTimestamp,
      expires_at
    );`);

  await instance.run(
    `UPDATE messages SET
      expirationStartTimestamp = json_extract(json, '$.expirationStartTimestamp'),
      expireTimer = json_extract(json, '$.expireTimer'),
      type = json_extract(json, '$.type');`
  );

  await instance.run('PRAGMA schema_version = 2;');
  await instance.run('COMMIT TRANSACTION;');

  console.log('updateToSchemaVersion2: success!');
}

async function updateToSchemaVersion3(currentVersion, instance) {
  if (currentVersion >= 3) {
    return;
  }

  console.log('updateToSchemaVersion3: starting...');

  await instance.run('BEGIN TRANSACTION;');

  await instance.run('DROP INDEX messages_expiring;');
  await instance.run('DROP INDEX messages_unread;');

  await instance.run(`CREATE INDEX messages_without_timer ON messages (
      expireTimer,
      expires_at,
      type
    ) WHERE expires_at IS NULL AND expireTimer IS NOT NULL;`);

  await instance.run(`CREATE INDEX messages_unread ON messages (
      conversationId,
      unread
    ) WHERE unread IS NOT NULL;`);

  await instance.run('ANALYZE;');
  await instance.run('PRAGMA schema_version = 3;');
  await instance.run('COMMIT TRANSACTION;');

  console.log('updateToSchemaVersion3: success!');
}

async function updateToSchemaVersion4(currentVersion, instance) {
  if (currentVersion >= 4) {
    return;
  }

  console.log('updateToSchemaVersion4: starting...');

  await instance.run('BEGIN TRANSACTION;');

  await instance.run(
    `CREATE TABLE conversations(
      id STRING PRIMARY KEY ASC,
      json TEXT,

      active_at INTEGER,
      type STRING,
      members TEXT,
      name TEXT,
      profileName TEXT
    );`
  );

  await instance.run(`CREATE INDEX conversations_active ON conversations (
      active_at
    ) WHERE active_at IS NOT NULL;`);

  await instance.run(`CREATE INDEX conversations_type ON conversations (
      type
    ) WHERE type IS NOT NULL;`);

  await instance.run('PRAGMA schema_version = 4;');
  await instance.run('COMMIT TRANSACTION;');

  console.log('updateToSchemaVersion4: success!');
}

async function updateToSchemaVersion6(currentVersion, instance) {
  if (currentVersion >= 6) {
    return;
  }
  console.log('updateToSchemaVersion6: starting...');
  await instance.run('BEGIN TRANSACTION;');

  // friendRequestStatus is no longer needed. So no need to add the column on new apps
  // await instance.run(
  //   `ALTER TABLE conversations
  //    ADD COLUMN friendRequestStatus INTEGER;`
  // );

  await instance.run(
    `CREATE TABLE lastHashes(
      snode TEXT PRIMARY KEY,
      hash TEXT,
      expiresAt INTEGER
    );`
  );

  await instance.run(
    `CREATE TABLE seenMessages(
      hash TEXT PRIMARY KEY,
      expiresAt INTEGER
    );`
  );

  // key-value, ids are strings, one extra column
  await instance.run(
    `CREATE TABLE sessions(
      id STRING PRIMARY KEY ASC,
      number STRING,
      json TEXT
    );`
  );

  await instance.run(`CREATE INDEX sessions_number ON sessions (
    number
  ) WHERE number IS NOT NULL;`);

  // key-value, ids are strings
  await instance.run(
    `CREATE TABLE groups(
      id STRING PRIMARY KEY ASC,
      json TEXT
    );`
  );
  await instance.run(
    `CREATE TABLE identityKeys(
      id STRING PRIMARY KEY ASC,
      json TEXT
    );`
  );
  await instance.run(
    `CREATE TABLE items(
      id STRING PRIMARY KEY ASC,
      json TEXT
    );`
  );

  // key-value, ids are integers
  await instance.run(
    `CREATE TABLE preKeys(
      id INTEGER PRIMARY KEY ASC,
      recipient STRING,
      json TEXT
    );`
  );
  await instance.run(
    `CREATE TABLE signedPreKeys(
      id INTEGER PRIMARY KEY ASC,
      json TEXT
    );`
  );

  await instance.run(
    `CREATE TABLE contactPreKeys(
      id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      identityKeyString VARCHAR(255),
      keyId INTEGER,
      json TEXT
    );`
  );

  await instance.run(`CREATE UNIQUE INDEX contact_prekey_identity_key_string_keyid ON contactPreKeys (
    identityKeyString,
    keyId
  );`);

  await instance.run(
    `CREATE TABLE contactSignedPreKeys(
      id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      identityKeyString VARCHAR(255),
      keyId INTEGER,
      json TEXT
    );`
  );

  await instance.run(`CREATE UNIQUE INDEX contact_signed_prekey_identity_key_string_keyid ON contactSignedPreKeys (
    identityKeyString,
    keyId
  );`);

  await instance.run('PRAGMA schema_version = 6;');
  await instance.run('COMMIT TRANSACTION;');
  console.log('updateToSchemaVersion6: success!');
}

async function updateToSchemaVersion7(currentVersion, instance) {
  if (currentVersion >= 7) {
    return;
  }
  console.log('updateToSchemaVersion7: starting...');
  await instance.run('BEGIN TRANSACTION;');

  // SQLite has been coercing our STRINGs into numbers, so we force it with TEXT
  // We create a new table then copy the data into it, since we can't modify columns

  await instance.run('DROP INDEX sessions_number;');
  await instance.run('ALTER TABLE sessions RENAME TO sessions_old;');

  await instance.run(
    `CREATE TABLE sessions(
      id TEXT PRIMARY KEY,
      number TEXT,
      json TEXT
    );`
  );

  await instance.run(`CREATE INDEX sessions_number ON sessions (
    number
  ) WHERE number IS NOT NULL;`);

  await instance.run(`INSERT INTO sessions(id, number, json)
    SELECT "+" || id, number, json FROM sessions_old;
  `);

  await instance.run('DROP TABLE sessions_old;');

  await instance.run('PRAGMA schema_version = 7;');
  await instance.run('COMMIT TRANSACTION;');
  console.log('updateToSchemaVersion7: success!');
}

async function updateToSchemaVersion8(currentVersion, instance) {
  if (currentVersion >= 8) {
    return;
  }
  console.log('updateToSchemaVersion8: starting...');
  await instance.run('BEGIN TRANSACTION;');

  // First, we pull a new body field out of the message table's json blob
  await instance.run(
    `ALTER TABLE messages
     ADD COLUMN body TEXT;`
  );
  await instance.run("UPDATE messages SET body = json_extract(json, '$.body')");

  // Then we create our full-text search table and populate it
  await instance.run(`
    CREATE VIRTUAL TABLE messages_fts
    USING fts5(id UNINDEXED, body);
  `);
  await instance.run(`
    INSERT INTO messages_fts(id, body)
    SELECT id, body FROM ${MESSAGES_TABLE};
  `);

  // Then we set up triggers to keep the full-text search table up to date
  await instance.run(`
    CREATE TRIGGER messages_on_insert AFTER INSERT ON messages BEGIN
      INSERT INTO messages_fts (
        id,
        body
      ) VALUES (
        new.id,
        new.body
      );
    END;
  `);
  await instance.run(`
    CREATE TRIGGER messages_on_delete AFTER DELETE ON messages BEGIN
      DELETE FROM messages_fts WHERE id = old.id;
    END;
  `);
  await instance.run(`
    CREATE TRIGGER messages_on_update AFTER UPDATE ON messages BEGIN
      DELETE FROM messages_fts WHERE id = old.id;
      INSERT INTO messages_fts(
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

  await instance.run('PRAGMA schema_version = 8;');
  await instance.run('COMMIT TRANSACTION;');
  console.log('updateToSchemaVersion8: success!');
}

async function updateToSchemaVersion9(currentVersion, instance) {
  if (currentVersion >= 9) {
    return;
  }
  console.log('updateToSchemaVersion9: starting...');
  await instance.run('BEGIN TRANSACTION;');

  await instance.run(`CREATE TABLE attachment_downloads(
    id STRING primary key,
    timestamp INTEGER,
    pending INTEGER,
    json TEXT
  );`);

  await instance.run(`CREATE INDEX attachment_downloads_timestamp
    ON attachment_downloads (
      timestamp
  ) WHERE pending = 0;`);
  await instance.run(`CREATE INDEX attachment_downloads_pending
    ON attachment_downloads (
      pending
  ) WHERE pending != 0;`);

  await instance.run('PRAGMA schema_version = 9;');
  await instance.run('COMMIT TRANSACTION;');
  console.log('updateToSchemaVersion9: success!');
}

async function updateToSchemaVersion10(currentVersion, instance) {
  if (currentVersion >= 10) {
    return;
  }
  console.log('updateToSchemaVersion10: starting...');
  await instance.run('BEGIN TRANSACTION;');

  await instance.run('DROP INDEX unprocessed_id;');
  await instance.run('DROP INDEX unprocessed_timestamp;');
  await instance.run('ALTER TABLE unprocessed RENAME TO unprocessed_old;');

  await instance.run(`CREATE TABLE unprocessed(
    id STRING,
    timestamp INTEGER,
    version INTEGER,
    attempts INTEGER,
    envelope TEXT,
    decrypted TEXT,
    source TEXT,
    sourceDevice TEXT,
    serverTimestamp INTEGER
  );`);

  await instance.run(`CREATE INDEX unprocessed_id ON unprocessed (
    id
  );`);
  await instance.run(`CREATE INDEX unprocessed_timestamp ON unprocessed (
    timestamp
  );`);

  await instance.run(`INSERT INTO unprocessed (
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
  `);

  await instance.run('DROP TABLE unprocessed_old;');

  await instance.run('PRAGMA schema_version = 10;');
  await instance.run('COMMIT TRANSACTION;');
  console.log('updateToSchemaVersion10: success!');
}

async function updateToSchemaVersion11(currentVersion, instance) {
  if (currentVersion >= 11) {
    return;
  }
  console.log('updateToSchemaVersion11: starting...');
  await instance.run('BEGIN TRANSACTION;');

  await instance.run('DROP TABLE groups;');

  await instance.run('PRAGMA schema_version = 11;');
  await instance.run('COMMIT TRANSACTION;');
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

async function updateSchema(instance) {
  const sqliteVersion = await getSQLiteVersion(instance);
  const schemaVersion = await getSchemaVersion(instance);
  const cipherVersion = await getSQLCipherVersion(instance);
  console.log(
    'updateSchema:',
    `Current schema version: ${schemaVersion};`,
    `Most recent schema version: ${SCHEMA_VERSIONS.length};`,
    `SQLite version: ${sqliteVersion};`,
    `SQLCipher version: ${cipherVersion};`
  );

  for (let index = 0, max = SCHEMA_VERSIONS.length; index < max; index += 1) {
    const runSchemaUpdate = SCHEMA_VERSIONS[index];

    // Yes, we really want to do this asynchronously, in order
    // eslint-disable-next-line no-await-in-loop
    await runSchemaUpdate(schemaVersion, instance);
  }
  await updateLokiSchema(instance);
}

const LOKI_SCHEMA_VERSIONS = [
  updateToLokiSchemaVersion1,
  updateToLokiSchemaVersion2,
  updateToLokiSchemaVersion3,
  updateToLokiSchemaVersion4,
  updateToLokiSchemaVersion5,
  updateToLokiSchemaVersion6,
  updateToLokiSchemaVersion7,
  updateToLokiSchemaVersion8,
  updateToLokiSchemaVersion9,
  updateToLokiSchemaVersion10,
  updateToLokiSchemaVersion11,
  updateToLokiSchemaVersion12,
];

const SERVERS_TOKEN_TABLE = 'servers';

async function updateToLokiSchemaVersion1(currentVersion, instance) {
  if (currentVersion >= 1) {
    return;
  }
  console.log('updateToLokiSchemaVersion1: starting...');
  await instance.run('BEGIN TRANSACTION;');

  await instance.run(
    `ALTER TABLE messages
     ADD COLUMN serverId INTEGER;`
  );
  await instance.run(
    `CREATE TABLE ${SERVERS_TOKEN_TABLE}(
      serverUrl STRING PRIMARY KEY ASC,
      token TEXT
    );`
  );

  await instance.run(
    `INSERT INTO loki_schema (
        version
      ) values (
        1
      );`
  );
  await instance.run('COMMIT TRANSACTION;');
  console.log('updateToLokiSchemaVersion1: success!');
}

async function updateToLokiSchemaVersion2(currentVersion, instance) {
  if (currentVersion >= 2) {
    return;
  }
  console.log('updateToLokiSchemaVersion2: starting...');
  await instance.run('BEGIN TRANSACTION;');

  await instance.run(
    `CREATE TABLE pairingAuthorisations(
      id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      primaryDevicePubKey VARCHAR(255),
      secondaryDevicePubKey VARCHAR(255),
      isGranted BOOLEAN,
      json TEXT,
      UNIQUE(primaryDevicePubKey, secondaryDevicePubKey)
    );`
  );

  await instance.run(
    `INSERT INTO loki_schema (
        version
      ) values (
        2
      );`
  );
  await instance.run('COMMIT TRANSACTION;');
  console.log('updateToLokiSchemaVersion2: success!');
}

async function updateToLokiSchemaVersion3(currentVersion, instance) {
  if (currentVersion >= 3) {
    return;
  }

  await instance.run(
    `CREATE TABLE ${GUARD_NODE_TABLE}(
      id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      ed25519PubKey VARCHAR(64)
    );`
  );

  console.log('updateToLokiSchemaVersion3: starting...');
  await instance.run('BEGIN TRANSACTION;');

  await instance.run(
    `INSERT INTO loki_schema (
        version
      ) values (
        3
      );`
  );

  await instance.run('COMMIT TRANSACTION;');
  console.log('updateToLokiSchemaVersion3: success!');
}

const SENDER_KEYS_TABLE = 'senderKeys';

async function updateToLokiSchemaVersion4(currentVersion, instance) {
  if (currentVersion >= 4) {
    return;
  }

  console.log('updateToLokiSchemaVersion4: starting...');
  await instance.run('BEGIN TRANSACTION;');

  // We don't bother migrating values, any old messages that
  // we might receive as a result will we filtered out anyway
  await instance.run(`DROP TABLE lastHashes;`);

  await instance.run(
    `CREATE TABLE lastHashes(
      id TEXT,
      snode TEXT,
      hash TEXT,
      expiresAt INTEGER,
      PRIMARY KEY (id, snode)
    );`
  );

  // Create a table for Sender Keys
  await instance.run(
    `CREATE TABLE ${SENDER_KEYS_TABLE} (
      groupId TEXT,
      senderIdentity TEXT,
      json TEXT,
      PRIMARY KEY (groupId, senderIdentity)
    );`
  );

  // Add senderIdentity field to `unprocessed` needed
  // for medium size groups
  await instance.run(`ALTER TABLE unprocessed ADD senderIdentity TEXT`);

  await instance.run(
    `INSERT INTO loki_schema (
        version
      ) values (
        4
      );`
  );

  await instance.run('COMMIT TRANSACTION;');
  console.log('updateToLokiSchemaVersion4: success!');
}

const NODES_FOR_PUBKEY_TABLE = 'nodesForPubkey';

async function updateToLokiSchemaVersion5(currentVersion, instance) {
  if (currentVersion >= 5) {
    return;
  }

  console.log('updateToLokiSchemaVersion5: starting...');

  await instance.run('BEGIN TRANSACTION;');

  await instance.run(
    `CREATE TABLE ${NODES_FOR_PUBKEY_TABLE} (
      pubkey TEXT PRIMARY KEY,
      json TEXT
    );`
  );

  await instance.run(
    `INSERT INTO loki_schema (
        version
      ) values (
        5
      );`
  );

  await instance.run('COMMIT TRANSACTION;');
  console.log('updateToLokiSchemaVersion5: success!');
}

async function updateToLokiSchemaVersion6(currentVersion, instance) {
  if (currentVersion >= 6) {
    return;
  }

  console.log('updateToLokiSchemaVersion6: starting...');

  await instance.run('BEGIN TRANSACTION;');

  // Remove RSS Feed conversations
  await instance.run(
    `DELETE FROM ${CONVERSATIONS_TABLE} WHERE
      type = 'group' AND
      id LIKE 'rss://%';`
  );

  await instance.run(
    `INSERT INTO loki_schema (
        version
      ) values (
        6
      );`
  );

  await instance.run('COMMIT TRANSACTION;');
  console.log('updateToLokiSchemaVersion6: success!');
}

async function updateToLokiSchemaVersion7(currentVersion, instance) {
  if (currentVersion >= 7) {
    return;
  }

  console.log('updateToLokiSchemaVersion7: starting...');

  await instance.run('BEGIN TRANSACTION;');

  // Remove multi device data
  await instance.run('DELETE FROM pairingAuthorisations;');

  await instance.run(
    `INSERT INTO loki_schema (
        version
      ) values (
        7
      );`
  );

  await instance.run('COMMIT TRANSACTION;');
  console.log('updateToLokiSchemaVersion7: success!');
}

async function updateToLokiSchemaVersion8(currentVersion, instance) {
  if (currentVersion >= 8) {
    return;
  }
  console.log('updateToLokiSchemaVersion8: starting...');
  await instance.run('BEGIN TRANSACTION;');

  await instance.run(
    `ALTER TABLE messages
     ADD COLUMN serverTimestamp INTEGER;`
  );

  await instance.run(
    `INSERT INTO loki_schema (
        version
      ) values (
        8
      );`
  );
  await instance.run('COMMIT TRANSACTION;');
  console.log('updateToLokiSchemaVersion8: success!');
}

async function updateToLokiSchemaVersion9(currentVersion, instance) {
  if (currentVersion >= 9) {
    return;
  }
  console.log('updateToLokiSchemaVersion9: starting...');
  await instance.run('BEGIN TRANSACTION;');

  await removePrefixFromGroupConversations(instance);

  await instance.run(
    `INSERT INTO loki_schema (
        version
      ) values (
        9
      );`
  );
  await instance.run('COMMIT TRANSACTION;');
  console.log('updateToLokiSchemaVersion9: success!');
}

async function updateToLokiSchemaVersion10(currentVersion, instance) {
  if (currentVersion >= 10) {
    return;
  }
  console.log('updateToLokiSchemaVersion10: starting...');
  await instance.run('BEGIN TRANSACTION;');

  await createEncryptionKeyPairsForClosedGroup(instance);

  await instance.run(
    `INSERT INTO loki_schema (
        version
      ) values (
        10
      );`
  );
  await instance.run('COMMIT TRANSACTION;');
  console.log('updateToLokiSchemaVersion10: success!');
}

async function updateToLokiSchemaVersion11(currentVersion, instance) {
  if (currentVersion >= 11) {
    return;
  }
  console.log('updateToLokiSchemaVersion11: starting...');
  await instance.run('BEGIN TRANSACTION;');

  await updateExistingClosedGroupToClosedGroup(instance);

  await instance.run(
    `INSERT INTO loki_schema (
        version
      ) values (
        11
      );`
  );
  await instance.run('COMMIT TRANSACTION;');
  console.log('updateToLokiSchemaVersion11: success!');
}

const OPEN_GROUP_ROOMS_V2_TABLE = 'openGroupRoomsV2';
async function updateToLokiSchemaVersion12(currentVersion, instance) {
  if (currentVersion >= 12) {
    return;
  }
  console.log('updateToLokiSchemaVersion12: starting...');
  await instance.run('BEGIN TRANSACTION;');

  await instance.run(
    `CREATE TABLE ${OPEN_GROUP_ROOMS_V2_TABLE} (
      serverUrl TEXT NOT NULL,
      roomId TEXT NOT NULL,
      conversationId TEXT,
      json TEXT,
      PRIMARY KEY (serverUrl, roomId)
    );`
  );

  await instance.run(
    `INSERT INTO loki_schema (
        version
      ) values (
        12
      );`
  );
  await instance.run('COMMIT TRANSACTION;');
  console.log('updateToLokiSchemaVersion12: success!');
}

async function updateLokiSchema(instance) {
  const result = await instance.get(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name='loki_schema';"
  );
  if (!result) {
    await createLokiSchemaTable(instance);
  }
  const lokiSchemaVersion = await getLokiSchemaVersion(instance);
  console.log(
    'updateLokiSchema:',
    `Current loki schema version: ${lokiSchemaVersion};`,
    `Most recent schema version: ${LOKI_SCHEMA_VERSIONS.length};`
  );
  for (
    let index = 0, max = LOKI_SCHEMA_VERSIONS.length;
    index < max;
    index += 1
  ) {
    const runSchemaUpdate = LOKI_SCHEMA_VERSIONS[index];

    // Yes, we really want to do this asynchronously, in order
    // eslint-disable-next-line no-await-in-loop
    await runSchemaUpdate(lokiSchemaVersion, instance);
  }
}

async function getLokiSchemaVersion(instance) {
  const result = await instance.get(
    'SELECT MAX(version) as version FROM loki_schema;'
  );
  if (!result || !result.version) {
    return 0;
  }
  return result.version;
}

async function createLokiSchemaTable(instance) {
  await instance.run('BEGIN TRANSACTION;');
  await instance.run(
    `CREATE TABLE loki_schema(
      id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      version INTEGER
    );`
  );
  await instance.run(
    `INSERT INTO loki_schema (
      version
    ) values (
      0
    );`
  );
  await instance.run('COMMIT TRANSACTION;');
}

let db;
let filePath;

function _initializePaths(configDir) {
  const dbDir = path.join(configDir, 'sql');
  mkdirp.sync(dbDir);

  filePath = path.join(dbDir, 'db.sqlite');
}

async function initialize({ configDir, key, messages, passwordAttempt }) {
  if (db) {
    throw new Error('Cannot initialize more than once!');
  }

  if (!isString(configDir)) {
    throw new Error('initialize: configDir is required!');
  }
  if (!isString(key)) {
    throw new Error('initialize: key is required!');
  }
  if (!isObject(messages)) {
    throw new Error('initialize: message is required!');
  }

  _initializePaths(configDir);

  try {
    const sqlInstance = await openDatabase(filePath);
    const promisified = promisify(sqlInstance);

    // promisified.on('trace', async statement => {
    //   if (!db || statement.startsWith('--')) {
    //     console._log(statement);
    //     return;
    //   }
    //   const data = await db.get(`EXPLAIN QUERY PLAN ${statement}`);
    //   console._log(`EXPLAIN QUERY PLAN ${statement}\n`, data && data.detail);
    // });

    try {
      await setupSQLCipher(promisified, { key });
      await updateSchema(promisified);
    } catch (e) {
      await promisified.close();
      throw e;
    }

    db = promisified;

    // test database

    const result = await getSQLIntegrityCheck(db);
    if (result) {
      console.log('Database integrity check failed:', result);
      throw new Error(`Integrity check failed: ${result}`);
    }

    await getMessageCount();
  } catch (error) {
    if (passwordAttempt) {
      throw error;
    }
    console.log('Database startup error:', error.stack);
    const buttonIndex = dialog.showMessageBox({
      buttons: [
        messages.copyErrorAndQuit.message,
        messages.clearAllData.message,
      ],
      defaultId: 0,
      detail: redactAll(error.stack),
      message: messages.databaseError.message,
      noLink: true,
      type: 'error',
    });

    if (buttonIndex === 0) {
      clipboard.writeText(
        `Database startup error:\n\n${redactAll(error.stack)}`
      );
    } else {
      await close();
      await removeDB();
      removeUserConfig();
      app.relaunch();
    }

    app.exit(1);
    return false;
  }

  return true;
}

async function close() {
  if (!db) {
    return;
  }
  const dbRef = db;
  db = null;
  await dbRef.close();
}

async function removeDB(configDir = null) {
  if (db) {
    throw new Error('removeDB: Cannot erase database when it is open!');
  }

  if (!filePath && configDir) {
    _initializePaths(configDir);
  }

  rimraf.sync(filePath);
}

// Password hash
const PASS_HASH_ID = 'passHash';
async function getPasswordHash() {
  const item = await getItemById(PASS_HASH_ID);
  return item && item.value;
}
async function savePasswordHash(hash) {
  if (isEmpty(hash)) {
    return removePasswordHash();
  }

  const data = { id: PASS_HASH_ID, value: hash };
  return createOrUpdateItem(data);
}
async function removePasswordHash() {
  return removeItemById(PASS_HASH_ID);
}

const IDENTITY_KEYS_TABLE = 'identityKeys';
async function getIdentityKeyById(id, instance) {
  return getById(IDENTITY_KEYS_TABLE, id, instance);
}

// those removeAll calls are currently only used to cleanup the db from old data
// TODO remove those and move those removeAll in a migration
const PRE_KEYS_TABLE = 'preKeys';
async function removeAllPreKeys() {
  return removeAllFromTable(PRE_KEYS_TABLE);
}
const CONTACT_PRE_KEYS_TABLE = 'contactPreKeys';
async function removeAllContactPreKeys() {
  return removeAllFromTable(CONTACT_PRE_KEYS_TABLE);
}
const CONTACT_SIGNED_PRE_KEYS_TABLE = 'contactSignedPreKeys';

async function removeAllContactSignedPreKeys() {
  return removeAllFromTable(CONTACT_SIGNED_PRE_KEYS_TABLE);
}
const SIGNED_PRE_KEYS_TABLE = 'signedPreKeys';
async function removeAllSignedPreKeys() {
  return removeAllFromTable(SIGNED_PRE_KEYS_TABLE);
}
const SESSIONS_TABLE = 'sessions';
async function removeAllSessions() {
  return removeAllFromTable(SESSIONS_TABLE);
}

const GUARD_NODE_TABLE = 'guardNodes';

async function getGuardNodes() {
  const nodes = await db.all(`SELECT ed25519PubKey FROM ${GUARD_NODE_TABLE};`);

  if (!nodes) {
    return null;
  }

  return nodes;
}

async function updateGuardNodes(nodes) {
  await db.run('BEGIN TRANSACTION;');

  await db.run(`DELETE FROM ${GUARD_NODE_TABLE}`);

  await Promise.all(
    nodes.map(edkey =>
      db.run(
        `INSERT INTO ${GUARD_NODE_TABLE} (
        ed25519PubKey
      ) values ($ed25519PubKey)`,
        {
          $ed25519PubKey: edkey,
        }
      )
    )
  );

  await db.run('END TRANSACTION;');
}

// Return all the paired pubkeys for a specific pubkey (excluded),
// irrespective of their Primary or Secondary status.

const ITEMS_TABLE = 'items';
async function createOrUpdateItem(data, instance) {
  return createOrUpdate(ITEMS_TABLE, data, instance);
}
async function getItemById(id) {
  return getById(ITEMS_TABLE, id);
}
async function getAllItems() {
  const rows = await db.all('SELECT json FROM items ORDER BY id ASC;');
  return map(rows, row => jsonToObject(row.json));
}
async function removeItemById(id) {
  return removeById(ITEMS_TABLE, id);
}

async function createOrUpdate(table, data, instance) {
  const { id } = data;
  if (!id) {
    throw new Error('createOrUpdate: Provided data did not have a truthy id');
  }

  await (db || instance).run(
    `INSERT OR REPLACE INTO ${table} (
      id,
      json
    ) values (
      $id,
      $json
    )`,
    {
      $id: id,
      $json: objectToJSON(data),
    }
  );
}

async function getById(table, id, instance) {
  const row = await (db || instance).get(
    `SELECT * FROM ${table} WHERE id = $id;`,
    {
      $id: id,
    }
  );

  if (!row) {
    return null;
  }

  return jsonToObject(row.json);
}

async function removeById(table, id) {
  if (!Array.isArray(id)) {
    await db.run(`DELETE FROM ${table} WHERE id = $id;`, { $id: id });
    return;
  }

  if (!id.length) {
    throw new Error('removeById: No ids to delete!');
  }

  // Our node interface doesn't seem to allow you to replace one single ? with an array
  await db.run(
    `DELETE FROM ${table} WHERE id IN ( ${id.map(() => '?').join(', ')} );`,
    id
  );
}

async function removeAllFromTable(table) {
  await db.run(`DELETE FROM ${table};`);
}

// Conversations

async function getSwarmNodesForPubkey(pubkey) {
  const row = await db.get(
    `SELECT * FROM ${NODES_FOR_PUBKEY_TABLE} WHERE pubkey = $pubkey;`,
    {
      $pubkey: pubkey,
    }
  );

  if (!row) {
    return [];
  }

  return jsonToObject(row.json);
}

async function updateSwarmNodesForPubkey(pubkey, snodeEdKeys) {
  await db.run(
    `INSERT OR REPLACE INTO ${NODES_FOR_PUBKEY_TABLE} (
        pubkey,
        json
        ) values (
          $pubkey,
          $json
          );`,
    {
      $pubkey: pubkey,
      $json: objectToJSON(snodeEdKeys),
    }
  );
}

const CONVERSATIONS_TABLE = 'conversations';
const MESSAGES_TABLE = 'messages';
async function getConversationCount() {
  const row = await db.get(`SELECT count(*) from ${CONVERSATIONS_TABLE};`);

  if (!row) {
    throw new Error(
      `getConversationCount: Unable to get count of ${CONVERSATIONS_TABLE}`
    );
  }

  return row['count(*)'];
}

async function saveConversation(data) {
  const {
    id,
    // eslint-disable-next-line camelcase
    active_at,
    type,
    members,
    name,
    profileName,
  } = data;

  await db.run(
    `INSERT INTO ${CONVERSATIONS_TABLE} (
    id,
    json,

    active_at,
    type,
    members,
    name,
    profileName
  ) values (
    $id,
    $json,

    $active_at,
    $type,
    $members,
    $name,
    $profileName
  );`,
    {
      $id: id,
      $json: objectToJSON(data),

      $active_at: active_at,
      $type: type,
      $members: members ? members.join(' ') : null,
      $name: name,
      $profileName: profileName,
    }
  );
}

async function updateConversation(data) {
  const {
    id,
    // eslint-disable-next-line camelcase
    active_at,
    type,
    members,
    name,
    profileName,
  } = data;

  await db.run(
    `UPDATE ${CONVERSATIONS_TABLE} SET
    json = $json,

    active_at = $active_at,
    type = $type,
    members = $members,
    name = $name,
    profileName = $profileName
  WHERE id = $id;`,
    {
      $id: id,
      $json: objectToJSON(data),

      $active_at: active_at,
      $type: type,
      $members: members ? members.join(' ') : null,
      $name: name,
      $profileName: profileName,
    }
  );
}

async function removeConversation(id) {
  if (!Array.isArray(id)) {
    await db.run(`DELETE FROM ${CONVERSATIONS_TABLE} WHERE id = $id;`, {
      $id: id,
    });
    return;
  }

  if (!id.length) {
    throw new Error('removeConversation: No ids to delete!');
  }

  // Our node interface doesn't seem to allow you to replace one single ? with an array
  await db.run(
    `DELETE FROM ${CONVERSATIONS_TABLE} WHERE id IN ( ${id
      .map(() => '?')
      .join(', ')} );`,
    id
  );
}

// open groups v1 only
async function savePublicServerToken(data) {
  const { serverUrl, token } = data;
  await db.run(
    `INSERT OR REPLACE INTO ${SERVERS_TOKEN_TABLE} (
      serverUrl,
      token
    ) values (
      $serverUrl,
      $token
    )`,
    {
      $serverUrl: serverUrl,
      $token: token,
    }
  );
}

// open groups v1 only
async function getPublicServerTokenByServerUrl(serverUrl) {
  const row = await db.get(
    `SELECT * FROM ${SERVERS_TOKEN_TABLE} WHERE serverUrl = $serverUrl;`,
    {
      $serverUrl: serverUrl,
    }
  );

  if (!row) {
    return null;
  }

  return row.token;
}

async function getConversationById(id) {
  const row = await db.get(
    `SELECT * FROM ${CONVERSATIONS_TABLE} WHERE id = $id;`,
    {
      $id: id,
    }
  );

  if (!row) {
    return null;
  }

  return jsonToObject(row.json);
}

async function getAllConversations() {
  const rows = await db.all(
    `SELECT json FROM ${CONVERSATIONS_TABLE} ORDER BY id ASC;`
  );
  return map(rows, row => jsonToObject(row.json));
}

async function getAllConversationIds() {
  const rows = await db.all(
    `SELECT id FROM ${CONVERSATIONS_TABLE} ORDER BY id ASC;`
  );
  return map(rows, row => row.id);
}

async function getAllPublicConversations() {
  const rows = await db.all(
    `SELECT json FROM ${CONVERSATIONS_TABLE} WHERE
      type = 'group' AND
      id LIKE 'publicChat:%'
     ORDER BY id ASC;`
  );

  return map(rows, row => jsonToObject(row.json));
}

async function getPubkeysInPublicConversation(id) {
  const rows = await db.all(
    `SELECT DISTINCT source FROM ${MESSAGES_TABLE} WHERE
      conversationId = $conversationId
     ORDER BY id ASC;`,
    {
      $conversationId: id,
    }
  );

  return map(rows, row => row.source);
}

async function getAllGroupsInvolvingId(id) {
  const rows = await db.all(
    `SELECT json FROM ${CONVERSATIONS_TABLE} WHERE
      type = 'group' AND
      members LIKE $id
     ORDER BY id ASC;`,
    {
      $id: `%${id}%`,
    }
  );

  return map(rows, row => jsonToObject(row.json));
}

async function searchConversations(query, { limit } = {}) {
  const rows = await db.all(
    `SELECT json FROM ${CONVERSATIONS_TABLE} WHERE
      (
        id LIKE $id OR
        name LIKE $name OR
        profileName LIKE $profileName
      )
     ORDER BY id ASC
     LIMIT $limit`,
    {
      $id: `%${query}%`,
      $name: `%${query}%`,
      $profileName: `%${query}%`,
      $limit: limit || 50,
    }
  );

  return map(rows, row => jsonToObject(row.json));
}

async function searchMessages(query, { limit } = {}) {
  const rows = await db.all(
    `SELECT
      messages.json,
      snippet(messages_fts, -1, '<<left>>', '<<right>>', '...', 15) as snippet
    FROM messages_fts
    INNER JOIN messages on messages_fts.id = messages.id
    WHERE
      messages_fts match $query
    ORDER BY messages.received_at DESC
    LIMIT $limit;`,
    {
      $query: query,
      $limit: limit || 100,
    }
  );

  return map(rows, row => ({
    ...jsonToObject(row.json),
    snippet: row.snippet,
  }));
}

async function searchMessagesInConversation(
  query,
  conversationId,
  { limit } = {}
) {
  const rows = await db.all(
    `SELECT
      messages.json,
      snippet(messages_fts, -1, '<<left>>', '<<right>>', '...', 15) as snippet
    FROM messages_fts
    INNER JOIN messages on messages_fts.id = messages.id
    WHERE
      messages_fts match $query AND
      messages.conversationId = $conversationId
    ORDER BY messages.received_at DESC
    LIMIT $limit;`,
    {
      $query: query,
      $conversationId: conversationId,
      $limit: limit || 100,
    }
  );

  return map(rows, row => ({
    ...jsonToObject(row.json),
    snippet: row.snippet,
  }));
}

async function getMessageCount() {
  const row = await db.get(`SELECT count(*) from ${MESSAGES_TABLE};`);

  if (!row) {
    throw new Error(
      `getMessageCount: Unable to get count of ${MESSAGES_TABLE}`
    );
  }

  return row['count(*)'];
}

async function saveMessage(data) {
  const {
    body,
    conversationId,
    // eslint-disable-next-line camelcase
    expires_at,
    hasAttachments,
    hasFileAttachments,
    hasVisualMediaAttachments,
    id,
    serverId,
    serverTimestamp,
    // eslint-disable-next-line camelcase
    received_at,
    schemaVersion,
    sent,
    // eslint-disable-next-line camelcase
    sent_at,
    source,
    sourceDevice,
    type,
    unread,
    expireTimer,
    expirationStartTimestamp,
  } = data;

  if (!id) {
    throw new Error('id is required');
  }

  if (!conversationId) {
    throw new Error('conversationId is required');
  }

  const payload = {
    $id: id,
    $json: objectToJSON(data),

    $serverId: serverId,
    $serverTimestamp: serverTimestamp,
    $body: body,
    $conversationId: conversationId,
    $expirationStartTimestamp: expirationStartTimestamp,
    $expires_at: expires_at,
    $expireTimer: expireTimer,
    $hasAttachments: hasAttachments,
    $hasFileAttachments: hasFileAttachments,
    $hasVisualMediaAttachments: hasVisualMediaAttachments,
    $received_at: received_at,
    $schemaVersion: schemaVersion,
    $sent: sent,
    $sent_at: sent_at,
    $source: source,
    $sourceDevice: sourceDevice,
    $type: type || '',
    $unread: unread,
  };

  await db.run(
    `INSERT OR REPLACE INTO ${MESSAGES_TABLE} (
    id,
    json,
    serverId,
    serverTimestamp,
    body,
    conversationId,
    expirationStartTimestamp,
    expires_at,
    expireTimer,
    hasAttachments,
    hasFileAttachments,
    hasVisualMediaAttachments,
    received_at,
    schemaVersion,
    sent,
    sent_at,
    source,
    sourceDevice,
    type,
    unread
  ) values (
    $id,
    $json,
    $serverId,
    $serverTimestamp,
    $body,
    $conversationId,
    $expirationStartTimestamp,
    $expires_at,
    $expireTimer,
    $hasAttachments,
    $hasFileAttachments,
    $hasVisualMediaAttachments,
    $received_at,
    $schemaVersion,
    $sent,
    $sent_at,
    $source,
    $sourceDevice,
    $type,
    $unread
  );`,
    {
      ...payload,
      $json: objectToJSON(data),
    }
  );

  return id;
}

async function saveSeenMessageHashes(arrayOfHashes) {
  let promise;

  db.serialize(() => {
    promise = Promise.all([
      db.run('BEGIN TRANSACTION;'),
      ...map(arrayOfHashes, hashData => saveSeenMessageHash(hashData)),
      db.run('COMMIT TRANSACTION;'),
    ]);
  });

  await promise;
}

async function updateLastHash(data) {
  const { convoId, snode, hash, expiresAt } = data;

  const id = convoId;

  await db.run(
    `INSERT OR REPLACE INTO lastHashes (
      id,
      snode,
      hash,
      expiresAt
    ) values (
      $id,
      $snode,
      $hash,
      $expiresAt
    )`,
    {
      $id: id,
      $snode: snode,
      $hash: hash,
      $expiresAt: expiresAt,
    }
  );
}

async function saveSeenMessageHash(data) {
  const { expiresAt, hash } = data;
  await db.run(
    `INSERT INTO seenMessages (
      expiresAt,
      hash
      ) values (
        $expiresAt,
        $hash
        );`,
    {
      $expiresAt: expiresAt,
      $hash: hash,
    }
  );
}

async function cleanLastHashes() {
  await db.run('DELETE FROM lastHashes WHERE expiresAt <= $now;', {
    $now: Date.now(),
  });
}

async function cleanSeenMessages() {
  await db.run('DELETE FROM seenMessages WHERE expiresAt <= $now;', {
    $now: Date.now(),
  });
}

async function saveMessages(arrayOfMessages) {
  let promise;

  db.serialize(() => {
    promise = Promise.all([
      db.run('BEGIN TRANSACTION;'),
      ...map(arrayOfMessages, message => saveMessage(message)),
      db.run('COMMIT TRANSACTION;'),
    ]);
  });

  await promise;
}

async function removeMessage(id) {
  if (!Array.isArray(id)) {
    await db.run(`DELETE FROM ${MESSAGES_TABLE} WHERE id = $id;`, { $id: id });
    return;
  }

  if (!id.length) {
    throw new Error('removeMessages: No ids to delete!');
  }

  // Our node interface doesn't seem to allow you to replace one single ? with an array
  await db.run(
    `DELETE FROM ${MESSAGES_TABLE} WHERE id IN ( ${id
      .map(() => '?')
      .join(', ')} );`,
    id
  );
}

async function getMessageIdsFromServerIds(serverIds, conversationId) {
  if (!Array.isArray(serverIds)) {
    return [];
  }

  // Sanitize the input as we're going to use it directly in the query
  const validIds = serverIds
    .map(id => Number(id))
    .filter(n => !Number.isNaN(n));

  /*
    Sqlite3 doesn't have a good way to have `IN` query with another query.
    See: https://github.com/mapbox/node-sqlite3/issues/762.

    So we have to use templating to insert the values.
  */
  const rows = await db.all(
    `SELECT id FROM ${MESSAGES_TABLE} WHERE
    serverId IN (${validIds.join(',')}) AND
    conversationId = $conversationId;`,
    {
      $conversationId: conversationId,
    }
  );
  return rows.map(row => row.id);
}

async function getMessageById(id) {
  const row = await db.get(`SELECT * FROM ${MESSAGES_TABLE} WHERE id = $id;`, {
    $id: id,
  });

  if (!row) {
    return null;
  }

  return jsonToObject(row.json);
}

async function getAllMessages() {
  const rows = await db.all(
    `SELECT json FROM ${MESSAGES_TABLE} ORDER BY id ASC;`
  );
  return map(rows, row => jsonToObject(row.json));
}

async function getAllMessageIds() {
  const rows = await db.all(
    `SELECT id FROM ${MESSAGES_TABLE} ORDER BY id ASC;`
  );
  return map(rows, row => row.id);
}

// eslint-disable-next-line camelcase
async function getMessageBySender({ source, sourceDevice, sent_at }) {
  const rows = await db.all(
    `SELECT json FROM ${MESSAGES_TABLE} WHERE
      source = $source AND
      sourceDevice = $sourceDevice AND
      sent_at = $sent_at;`,
    {
      $source: source,
      $sourceDevice: sourceDevice,
      $sent_at: sent_at,
    }
  );

  return map(rows, row => jsonToObject(row.json));
}

async function getUnreadByConversation(conversationId) {
  const rows = await db.all(
    `SELECT json FROM ${MESSAGES_TABLE} WHERE
      unread = $unread AND
      conversationId = $conversationId
     ORDER BY received_at DESC;`,
    {
      $unread: 1,
      $conversationId: conversationId,
    }
  );

  return map(rows, row => jsonToObject(row.json));
}

async function getUnreadCountByConversation(conversationId) {
  const row = await db.get(
    `SELECT count(*) from ${MESSAGES_TABLE} WHERE
    unread = $unread AND
    conversationId = $conversationId
    ORDER BY received_at DESC;`,
    {
      $unread: 1,
      $conversationId: conversationId,
    }
  );

  if (!row) {
    throw new Error(
      `getUnreadCountByConversation: Unable to get unread count of ${conversationId}`
    );
  }

  return row['count(*)'];
}

// Note: Sorting here is necessary for getting the last message (with limit 1)
// be sure to update the sorting order to sort messages on reduxz too (sortMessages

async function getMessagesByConversation(
  conversationId,
  { limit = 100, receivedAt = Number.MAX_VALUE, type = '%' } = {}
) {
  const rows = await db.all(
    `
    SELECT json FROM ${MESSAGES_TABLE} WHERE
      conversationId = $conversationId AND
      received_at < $received_at AND
      type LIKE $type
      ORDER BY serverTimestamp DESC, serverId DESC, sent_at DESC, received_at DESC
    LIMIT $limit;
    `,
    {
      $conversationId: conversationId,
      $received_at: receivedAt,
      $limit: limit,
      $type: type,
    }
  );
  return map(rows, row => jsonToObject(row.json));
}

async function getMessagesBySentAt(sentAt) {
  const rows = await db.all(
    `SELECT * FROM ${MESSAGES_TABLE}
     WHERE sent_at = $sent_at
     ORDER BY received_at DESC;`,
    {
      $sent_at: sentAt,
    }
  );

  return map(rows, row => jsonToObject(row.json));
}

async function getLastHashBySnode(convoId, snode) {
  const row = await db.get(
    'SELECT * FROM lastHashes WHERE snode = $snode AND id = $id;',
    {
      $snode: snode,
      $id: convoId,
    }
  );

  if (!row) {
    return null;
  }

  return row.hash;
}

async function getSeenMessagesByHashList(hashes) {
  const rows = await db.all(
    `SELECT * FROM seenMessages WHERE hash IN ( ${hashes
      .map(() => '?')
      .join(', ')} );`,
    hashes
  );

  return map(rows, row => row.hash);
}

async function getExpiredMessages() {
  const now = Date.now();

  const rows = await db.all(
    `SELECT json FROM ${MESSAGES_TABLE} WHERE
      expires_at IS NOT NULL AND
      expires_at <= $expires_at
     ORDER BY expires_at ASC;`,
    {
      $expires_at: now,
    }
  );

  return map(rows, row => jsonToObject(row.json));
}

async function getOutgoingWithoutExpiresAt() {
  const rows = await db.all(`
    SELECT json FROM ${MESSAGES_TABLE}
    WHERE
      expireTimer > 0 AND
      expires_at IS NULL AND
      type IS 'outgoing'
    ORDER BY expires_at ASC;
  `);

  return map(rows, row => jsonToObject(row.json));
}

async function getNextExpiringMessage() {
  const rows = await db.all(`
    SELECT json FROM ${MESSAGES_TABLE}
    WHERE expires_at > 0
    ORDER BY expires_at ASC
    LIMIT 1;
  `);

  return map(rows, row => jsonToObject(row.json));
}

/* Unproccessed a received messages not yet processed */
async function saveUnprocessed(data) {
  const { id, timestamp, version, attempts, envelope, senderIdentity } = data;
  if (!id) {
    throw new Error(`saveUnprocessed: id was falsey: ${id}`);
  }

  await db.run(
    `INSERT OR REPLACE INTO unprocessed (
      id,
      timestamp,
      version,
      attempts,
      envelope,
      senderIdentity
    ) values (
      $id,
      $timestamp,
      $version,
      $attempts,
      $envelope,
      $senderIdentity
    );`,
    {
      $id: id,
      $timestamp: timestamp,
      $version: version,
      $attempts: attempts,
      $envelope: envelope,
      $senderIdentity: senderIdentity,
    }
  );

  return id;
}

async function updateUnprocessedAttempts(id, attempts) {
  await db.run('UPDATE unprocessed SET attempts = $attempts WHERE id = $id;', {
    $id: id,
    $attempts: attempts,
  });
}
async function updateUnprocessedWithData(id, data = {}) {
  const {
    source,
    sourceDevice,
    serverTimestamp,
    decrypted,
    senderIdentity,
  } = data;

  await db.run(
    `UPDATE unprocessed SET
      source = $source,
      sourceDevice = $sourceDevice,
      serverTimestamp = $serverTimestamp,
      decrypted = $decrypted,
      senderIdentity = $senderIdentity
    WHERE id = $id;`,
    {
      $id: id,
      $source: source,
      $sourceDevice: sourceDevice,
      $serverTimestamp: serverTimestamp,
      $decrypted: decrypted,
      $senderIdentity: senderIdentity,
    }
  );
}

async function getUnprocessedById(id) {
  const row = await db.get('SELECT * FROM unprocessed WHERE id = $id;', {
    $id: id,
  });

  return row;
}

async function getUnprocessedCount() {
  const row = await db.get('SELECT count(*) from unprocessed;');

  if (!row) {
    throw new Error('getMessageCount: Unable to get count of unprocessed');
  }

  return row['count(*)'];
}

async function getAllUnprocessed() {
  const rows = await db.all(
    'SELECT * FROM unprocessed ORDER BY timestamp ASC;'
  );

  return rows;
}

async function removeUnprocessed(id) {
  if (!Array.isArray(id)) {
    await db.run('DELETE FROM unprocessed WHERE id = $id;', { $id: id });
    return;
  }

  if (!id.length) {
    throw new Error('removeUnprocessed: No ids to delete!');
  }

  // Our node interface doesn't seem to allow you to replace one single ? with an array
  await db.run(
    `DELETE FROM unprocessed WHERE id IN ( ${id.map(() => '?').join(', ')} );`,
    id
  );
}

async function removeAllUnprocessed() {
  await db.run('DELETE FROM unprocessed;');
}

const ATTACHMENT_DOWNLOADS_TABLE = 'attachment_downloads';
async function getNextAttachmentDownloadJobs(limit, options = {}) {
  const timestamp = options.timestamp || Date.now();

  const rows = await db.all(
    `SELECT json FROM attachment_downloads
    WHERE pending = 0 AND timestamp < $timestamp
    ORDER BY timestamp DESC
    LIMIT $limit;`,
    {
      $limit: limit,
      $timestamp: timestamp,
    }
  );

  return map(rows, row => jsonToObject(row.json));
}
async function saveAttachmentDownloadJob(job) {
  const { id, pending, timestamp } = job;
  if (!id) {
    throw new Error(
      'saveAttachmentDownloadJob: Provided job did not have a truthy id'
    );
  }

  await db.run(
    `INSERT OR REPLACE INTO attachment_downloads (
      id,
      pending,
      timestamp,
      json
    ) values (
      $id,
      $pending,
      $timestamp,
      $json
    )`,
    {
      $id: id,
      $pending: pending,
      $timestamp: timestamp,
      $json: objectToJSON(job),
    }
  );
}
async function setAttachmentDownloadJobPending(id, pending) {
  await db.run(
    'UPDATE attachment_downloads SET pending = $pending WHERE id = $id;',
    {
      $id: id,
      $pending: pending,
    }
  );
}
async function resetAttachmentDownloadPending() {
  await db.run(
    'UPDATE attachment_downloads SET pending = 0 WHERE pending != 0;'
  );
}
async function removeAttachmentDownloadJob(id) {
  return removeById(ATTACHMENT_DOWNLOADS_TABLE, id);
}
async function removeAllAttachmentDownloadJobs() {
  return removeAllFromTable(ATTACHMENT_DOWNLOADS_TABLE);
}

// All data in database
async function removeAll() {
  let promise;

  db.serialize(() => {
    promise = Promise.all([
      db.run('BEGIN TRANSACTION;'),
      db.run('DELETE FROM identityKeys;'),
      db.run('DELETE FROM items;'),
      db.run('DELETE FROM preKeys;'),
      db.run('DELETE FROM sessions;'),
      db.run('DELETE FROM signedPreKeys;'),
      db.run('DELETE FROM unprocessed;'),
      db.run('DELETE FROM contactPreKeys;'),
      db.run('DELETE FROM contactSignedPreKeys;'),
      db.run(`DELETE FROM ${SERVERS_TOKEN_TABLE};`),
      db.run('DELETE FROM lastHashes;'),
      db.run(`DELETE FROM ${SENDER_KEYS_TABLE};`),
      db.run(`DELETE FROM ${NODES_FOR_PUBKEY_TABLE};`),
      db.run(`DELETE FROM ${CLOSED_GROUP_V2_KEY_PAIRS_TABLE};`),
      db.run('DELETE FROM seenMessages;'),
      db.run(`DELETE FROM ${CONVERSATIONS_TABLE};`),
      db.run(`DELETE FROM ${MESSAGES_TABLE};`),
      db.run('DELETE FROM attachment_downloads;'),
      db.run('DELETE FROM messages_fts;'),
      db.run('COMMIT TRANSACTION;'),
    ]);
  });

  await promise;
}

async function removeAllConversations() {
  await removeAllFromTable(CONVERSATIONS_TABLE);
}

async function getMessagesWithVisualMediaAttachments(
  conversationId,
  { limit }
) {
  const rows = await db.all(
    `SELECT json FROM ${MESSAGES_TABLE} WHERE
      conversationId = $conversationId AND
      hasVisualMediaAttachments = 1
     ORDER BY received_at DESC
     LIMIT $limit;`,
    {
      $conversationId: conversationId,
      $limit: limit,
    }
  );

  return map(rows, row => jsonToObject(row.json));
}

async function getMessagesWithFileAttachments(conversationId, { limit }) {
  const rows = await db.all(
    `SELECT json FROM ${MESSAGES_TABLE} WHERE
      conversationId = $conversationId AND
      hasFileAttachments = 1
     ORDER BY received_at DESC
     LIMIT $limit;`,
    {
      $conversationId: conversationId,
      $limit: limit,
    }
  );

  return map(rows, row => jsonToObject(row.json));
}

function getExternalFilesForMessage(message) {
  const { attachments, contact, quote, preview } = message;
  const files = [];

  forEach(attachments, attachment => {
    const { path: file, thumbnail, screenshot } = attachment;
    if (file) {
      files.push(file);
    }

    if (thumbnail && thumbnail.path) {
      files.push(thumbnail.path);
    }

    if (screenshot && screenshot.path) {
      files.push(screenshot.path);
    }
  });

  if (quote && quote.attachments && quote.attachments.length) {
    forEach(quote.attachments, attachment => {
      const { thumbnail } = attachment;

      if (thumbnail && thumbnail.path) {
        files.push(thumbnail.path);
      }
    });
  }

  if (contact && contact.length) {
    forEach(contact, item => {
      const { avatar } = item;

      if (avatar && avatar.avatar && avatar.avatar.path) {
        files.push(avatar.avatar.path);
      }
    });
  }

  if (preview && preview.length) {
    forEach(preview, item => {
      const { image } = item;

      if (image && image.path) {
        files.push(image.path);
      }
    });
  }

  return files;
}

function getExternalFilesForConversation(conversation) {
  const { avatar, profileAvatar } = conversation;
  const files = [];

  if (avatar && avatar.path) {
    files.push(avatar.path);
  }

  if (profileAvatar && profileAvatar.path) {
    files.push(profileAvatar.path);
  }

  return files;
}

async function removeKnownAttachments(allAttachments) {
  const lookup = fromPairs(map(allAttachments, file => [file, true]));
  const chunkSize = 50;

  const total = await getMessageCount();
  console.log(
    `removeKnownAttachments: About to iterate through ${total} messages`
  );

  let count = 0;
  let complete = false;
  let id = '';

  while (!complete) {
    // eslint-disable-next-line no-await-in-loop
    const rows = await db.all(
      `SELECT json FROM ${MESSAGES_TABLE}
       WHERE id > $id
       ORDER BY id ASC
       LIMIT $chunkSize;`,
      {
        $id: id,
        $chunkSize: chunkSize,
      }
    );

    const messages = map(rows, row => jsonToObject(row.json));
    forEach(messages, message => {
      const externalFiles = getExternalFilesForMessage(message);
      forEach(externalFiles, file => {
        delete lookup[file];
      });
    });

    const lastMessage = last(messages);
    if (lastMessage) {
      ({ id } = lastMessage);
    }
    complete = messages.length < chunkSize;
    count += messages.length;
  }

  console.log(`removeKnownAttachments: Done processing ${count} messages`);

  complete = false;
  count = 0;
  // Though conversations.id is a string, this ensures that, when coerced, this
  //   value is still a string but it's smaller than every other string.
  id = 0;

  const conversationTotal = await getConversationCount();
  console.log(
    `removeKnownAttachments: About to iterate through ${conversationTotal} conversations`
  );

  while (!complete) {
    // eslint-disable-next-line no-await-in-loop
    const rows = await db.all(
      `SELECT json FROM ${CONVERSATIONS_TABLE}
       WHERE id > $id
       ORDER BY id ASC
       LIMIT $chunkSize;`,
      {
        $id: id,
        $chunkSize: chunkSize,
      }
    );

    const conversations = map(rows, row => jsonToObject(row.json));
    forEach(conversations, conversation => {
      const externalFiles = getExternalFilesForConversation(conversation);
      forEach(externalFiles, file => {
        delete lookup[file];
      });
    });

    const lastMessage = last(conversations);
    if (lastMessage) {
      ({ id } = lastMessage);
    }
    complete = conversations.length < chunkSize;
    count += conversations.length;
  }

  console.log(`removeKnownAttachments: Done processing ${count} conversations`);

  return Object.keys(lookup);
}

async function getMessagesCountByConversation(instance, conversationId) {
  const row = await instance.get(
    `SELECT count(*) from ${MESSAGES_TABLE} WHERE conversationId = $conversationId;`,
    { $conversationId: conversationId }
  );

  return row ? row['count(*)'] : 0;
}

async function removePrefixFromGroupConversations(instance) {
  const rows = await instance.all(
    `SELECT json FROM ${CONVERSATIONS_TABLE} WHERE
      type = 'group' AND
      id LIKE '__textsecure_group__!%';`
  );

  const objs = map(rows, row => jsonToObject(row.json));

  const conversationIdRows = await instance.all(
    `SELECT id FROM ${CONVERSATIONS_TABLE} ORDER BY id ASC;`
  );
  const allOldConversationIds = map(conversationIdRows, row => row.id);

  await Promise.all(
    objs.map(async o => {
      const oldId = o.id;
      const newId = oldId.replace('__textsecure_group__!', '');
      console.log(`migrating conversation, ${oldId} to ${newId}`);

      if (allOldConversationIds.includes(newId)) {
        console.log(
          'Found a duplicate conversation after prefix removing. We need to take care of it'
        );
        // We have another conversation with the same future name.
        // We decided to keep only the conversation with the higher number of messages
        const countMessagesOld = await getMessagesCountByConversation(
          instance,
          oldId,
          { limit: Number.MAX_VALUE }
        );
        const countMessagesNew = await getMessagesCountByConversation(
          instance,
          newId,
          { limit: Number.MAX_VALUE }
        );

        console.log(
          `countMessagesOld: ${countMessagesOld}, countMessagesNew: ${countMessagesNew}`
        );

        const deleteId = countMessagesOld > countMessagesNew ? newId : oldId;
        await instance.run(
          `DELETE FROM ${CONVERSATIONS_TABLE} WHERE id = $id;`,
          {
            $id: deleteId,
          }
        );
      }

      const morphedObject = {
        ...o,
        id: newId,
      };

      await instance.run(
        `UPDATE ${CONVERSATIONS_TABLE} SET
        id = $newId,
        json = $json
        WHERE id = $oldId;`,
        {
          $newId: newId,
          $json: objectToJSON(morphedObject),
          $oldId: oldId,
        }
      );
    })
  );
}

const CLOSED_GROUP_V2_KEY_PAIRS_TABLE = 'encryptionKeyPairsForClosedGroupV2';

async function createEncryptionKeyPairsForClosedGroup(instance) {
  await instance.run(
    `CREATE TABLE ${CLOSED_GROUP_V2_KEY_PAIRS_TABLE} (
      id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      groupPublicKey TEXT,
      timestamp NUMBER,
      json TEXT
    );` // json is the keypair
  );
}

async function getAllClosedGroupConversations(instance) {
  const rows = await (db || instance).all(
    `SELECT json FROM ${CONVERSATIONS_TABLE} WHERE
      type = 'group' AND
      id NOT LIKE 'publicChat:%'
     ORDER BY id ASC;`
  );

  return map(rows, row => jsonToObject(row.json));
}

function remove05PrefixFromStringIfNeeded(str) {
  if (str.length === 66 && str.startsWith('05')) {
    return str.substr(2);
  }
  return str;
}

async function updateExistingClosedGroupToClosedGroup(instance) {
  // the migration is called only once, so all current groups not being open groups are v1 closed group.
  const allClosedGroupV1 =
    (await getAllClosedGroupConversations(instance)) || [];

  await Promise.all(
    allClosedGroupV1.map(async groupV1 => {
      const groupId = groupV1.id;
      try {
        console.log('Migrating closed group v1 to v2: pubkey', groupId);
        const groupV1IdentityKey = await getIdentityKeyById(groupId, instance);
        const encryptionPubKeyWithoutPrefix = remove05PrefixFromStringIfNeeded(
          groupV1IdentityKey.id
        );

        // Note:
        // this is what we get from getIdentityKeyById:
        //   {
        //     id: string;
        //     secretKey?: string;
        //   }

        // and this is what we want saved in db:
        //   {
        //    publicHex: string; // without prefix
        //    privateHex: string;
        //   }
        const keyPair = {
          publicHex: encryptionPubKeyWithoutPrefix,
          privateHex: groupV1IdentityKey.secretKey,
        };
        await addClosedGroupEncryptionKeyPair(groupId, keyPair, instance);
      } catch (e) {
        console.warn(e);
      }
    })
  );
}

/**
 * The returned array is ordered based on the timestamp, the latest is at the end.
 * @param {*} groupPublicKey string | PubKey
 */
async function getAllEncryptionKeyPairsForGroup(groupPublicKey) {
  const rows = await getAllEncryptionKeyPairsForGroupRaw(groupPublicKey);

  return map(rows, row => jsonToObject(row.json));
}

async function getAllEncryptionKeyPairsForGroupRaw(groupPublicKey) {
  const pubkeyAsString = groupPublicKey.key
    ? groupPublicKey.key
    : groupPublicKey;
  const rows = await db.all(
    `SELECT * FROM ${CLOSED_GROUP_V2_KEY_PAIRS_TABLE} WHERE groupPublicKey = $groupPublicKey ORDER BY timestamp ASC;`,
    {
      $groupPublicKey: pubkeyAsString,
    }
  );

  return rows;
}

async function getLatestClosedGroupEncryptionKeyPair(groupPublicKey) {
  const rows = await getAllEncryptionKeyPairsForGroup(groupPublicKey);
  if (!rows || rows.length === 0) {
    return undefined;
  }
  return rows[rows.length - 1];
}

async function addClosedGroupEncryptionKeyPair(
  groupPublicKey,
  keypair,
  instance
) {
  const timestamp = Date.now();

  await (db || instance).run(
    `INSERT OR REPLACE INTO ${CLOSED_GROUP_V2_KEY_PAIRS_TABLE} (
      groupPublicKey,
      timestamp,
        json
        ) values (
          $groupPublicKey,
          $timestamp,
          $json
          );`,
    {
      $groupPublicKey: groupPublicKey,
      $timestamp: timestamp,
      $json: objectToJSON(keypair),
    }
  );
}

async function isKeyPairAlreadySaved(
  groupPublicKey,
  newKeyPairInHex // : HexKeyPair
) {
  const allKeyPairs = await getAllEncryptionKeyPairsForGroup(groupPublicKey);
  return (allKeyPairs || []).some(
    k =>
      newKeyPairInHex.publicHex === k.publicHex &&
      newKeyPairInHex.privateHex === k.privateHex
  );
}

async function removeAllClosedGroupEncryptionKeyPairs(groupPublicKey) {
  await db.run(
    `DELETE FROM ${CLOSED_GROUP_V2_KEY_PAIRS_TABLE} WHERE groupPublicKey = $groupPublicKey`,
    {
      $groupPublicKey: groupPublicKey,
    }
  );
}

/**
 * Related to Opengroup V2
 */
async function getAllV2OpenGroupRooms() {
  const rows = await db.all(`SELECT json FROM ${OPEN_GROUP_ROOMS_V2_TABLE};`);

  return map(rows, row => jsonToObject(row.json));
}

async function getV2OpenGroupRoom(conversationId) {
  const row = await db.get(
    `SELECT * FROM ${OPEN_GROUP_ROOMS_V2_TABLE} WHERE conversationId = $conversationId;`,
    {
      $conversationId: conversationId,
    }
  );

  if (!row) {
    return null;
  }

  return jsonToObject(row.json);
}

async function getV2OpenGroupRoomByRoomId(serverUrl, roomId) {
  const row = await db.get(
    `SELECT * FROM ${OPEN_GROUP_ROOMS_V2_TABLE} WHERE serverUrl = $serverUrl AND roomId = $roomId;`,
    {
      $serverUrl: serverUrl,
      $roomId: roomId,
    }
  );

  if (!row) {
    return null;
  }

  return jsonToObject(row.json);
}

async function saveV2OpenGroupRoom(opengroupsv2Room) {
  const { serverUrl, roomId, conversationId } = opengroupsv2Room;
  await db.run(
    `INSERT OR REPLACE INTO ${OPEN_GROUP_ROOMS_V2_TABLE} (
      serverUrl,
      roomId,
      conversationId,
      json
    ) values (
      $serverUrl,
      $roomId,
      $conversationId,
      $json
    )`,
    {
      $serverUrl: serverUrl,
      $roomId: roomId,
      $conversationId: conversationId,
      $json: objectToJSON(opengroupsv2Room),
    }
  );
}

async function removeV2OpenGroupRoom(conversationId) {
  await db.run(
    `DELETE FROM ${OPEN_GROUP_ROOMS_V2_TABLE} WHERE conversationId = $conversationId`,
    {
      $conversationId: conversationId,
    }
  );
}

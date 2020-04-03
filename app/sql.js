const path = require('path');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const sql = require('@journeyapps/sqlcipher');
const { app, dialog, clipboard } = require('electron');
const { redactAll } = require('../js/modules/privacy');
const { remove: removeUserConfig } = require('./user_config');
const config = require('./config');

const pify = require('pify');
const uuidv4 = require('uuid/v4');
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
  removeIndexedDBFiles,
  setSQLPassword,

  getPasswordHash,
  savePasswordHash,
  removePasswordHash,

  createOrUpdateIdentityKey,
  getIdentityKeyById,
  bulkAddIdentityKeys,
  removeIdentityKeyById,
  removeAllIdentityKeys,
  getAllIdentityKeys,

  createOrUpdatePreKey,
  getPreKeyById,
  getPreKeyByRecipient,
  bulkAddPreKeys,
  removePreKeyById,
  removeAllPreKeys,
  getAllPreKeys,

  createOrUpdateSignedPreKey,
  getSignedPreKeyById,
  getAllSignedPreKeys,
  bulkAddSignedPreKeys,
  removeSignedPreKeyById,
  removeAllSignedPreKeys,

  createOrUpdateContactPreKey,
  getContactPreKeyById,
  getContactPreKeyByIdentityKey,
  getContactPreKeys,
  getAllContactPreKeys,
  bulkAddContactPreKeys,
  removeContactPreKeyByIdentityKey,
  removeAllContactPreKeys,

  createOrUpdateContactSignedPreKey,
  getContactSignedPreKeyById,
  getContactSignedPreKeyByIdentityKey,
  getContactSignedPreKeys,
  bulkAddContactSignedPreKeys,
  removeContactSignedPreKeyByIdentityKey,
  removeAllContactSignedPreKeys,

  createOrUpdatePairingAuthorisation,
  removePairingAuthorisationForSecondaryPubKey,
  getAuthorisationForSecondaryPubKey,
  getGrantAuthorisationsForPrimaryPubKey,
  getSecondaryDevicesFor,
  getPrimaryDeviceFor,
  getPairedDevicesFor,

  createOrUpdateItem,
  getItemById,
  getAllItems,
  bulkAddItems,
  removeItemById,
  removeAllItems,

  createOrUpdateSession,
  getSessionById,
  getSessionsByNumber,
  bulkAddSessions,
  removeSessionById,
  removeSessionsByNumber,
  removeAllSessions,
  getAllSessions,

  getSwarmNodesByPubkey,

  getConversationCount,
  saveConversation,
  saveConversations,
  getConversationById,
  savePublicServerToken,
  getPublicServerTokenByServerUrl,
  updateConversation,
  removeConversation,
  getAllConversations,
  getPubKeysWithFriendStatus,
  getConversationsWithFriendStatus,
  getAllRssFeedConversations,
  getAllPublicConversations,
  getPublicConversationsByServer,
  getPubkeysInPublicConversation,
  getAllConversationIds,
  getAllPrivateConversations,
  getAllGroupsInvolvingId,
  removeAllConversations,
  removeAllPrivateConversations,

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
  getMessageBySender,
  getMessageByServerId,
  getMessageById,
  getAllMessages,
  getAllMessageIds,
  getAllUnsentMessages,
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
  saveUnprocesseds,
  removeUnprocessed,
  removeAllUnprocessed,

  getNextAttachmentDownloadJobs,
  saveAttachmentDownloadJob,
  setAttachmentDownloadJobPending,
  resetAttachmentDownloadPending,
  removeAttachmentDownloadJob,
  removeAllAttachmentDownloadJobs,

  removeAll,
  removeAllConfiguration,

  getMessagesNeedingUpgrade,
  getMessagesWithVisualMediaAttachments,
  getMessagesWithFileAttachments,

  removeKnownAttachments,
};

function generateUUID() {
  return uuidv4();
}

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

  await instance.run(
    `ALTER TABLE conversations
     ADD COLUMN friendRequestStatus INTEGER;`
  );

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
    SELECT id, body FROM messages;
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
];

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
    `CREATE TABLE servers(
      serverUrl STRING PRIMARY KEY ASC,
      token TEXT
    );`
  );

  const initConversation = async data => {
    // eslint-disable-next-line camelcase
    const { id, active_at, type, name, friendRequestStatus } = data;
    await instance.run(
      `INSERT INTO conversations (
      id,
      json,
      active_at,
      type,
      members,
      name,
      friendRequestStatus
    ) values (
      $id,
      $json,
      $active_at,
      $type,
      $members,
      $name,
      $friendRequestStatus
    );`,
      {
        $id: id,
        $json: objectToJSON(data),
        $active_at: active_at,
        $type: type,
        $members: null,
        $name: name,
        $friendRequestStatus: friendRequestStatus,
      }
    );
  };

  const lokiPublicServerData = {
    // make sure we don't have a trailing slash just in case
    serverUrl: config.get('defaultPublicChatServer').replace(/\/*$/, ''),
    token: null,
  };
  console.log('lokiPublicServerData', lokiPublicServerData);

  const baseData = {
    active_at: Date.now(),
    friendRequestStatus: 4, // Friends
    sealedSender: 0,
    sessionResetStatus: 0,
    swarmNodes: [],
    type: 'group',
    unlockTimestamp: null,
    unreadCount: 0,
    verified: 0,
    version: 2,
  };

  const publicChatData = {
    ...baseData,
    id: `publicChat:1@${lokiPublicServerData.serverUrl.replace(
      /^https?:\/\//i,
      ''
    )}`,
    server: lokiPublicServerData.serverUrl,
    name: 'Loki Public Chat',
    channelId: '1',
  };

  const { serverUrl, token } = lokiPublicServerData;

  await instance.run(
    `INSERT INTO servers (
    serverUrl,
    token
  ) values (
    $serverUrl,
    $token
  );`,
    {
      $serverUrl: serverUrl,
      $token: token,
    }
  );

  const newsRssFeedData = {
    ...baseData,
    id: 'rss://loki.network/feed/',
    rssFeed: 'https://loki.network/feed/',
    closable: true,
    name: 'Loki News',
    profileAvatar: 'images/session/session_chat_icon.png',
  };

  const updatesRssFeedData = {
    ...baseData,
    id: 'rss://loki.network/category/messenger-updates/feed/',
    rssFeed: 'https://loki.network/category/messenger-updates/feed/',
    closable: false,
    name: 'Session Updates',
    profileAvatar: 'images/session/session_chat_icon.png',
  };

  const autoJoinLokiChats = false;

  if (autoJoinLokiChats) {
    await initConversation(publicChatData);
  }

  await initConversation(newsRssFeedData);
  await initConversation(updatesRssFeedData);

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
let indexedDBPath;

function _initializePaths(configDir) {
  indexedDBPath = path.join(configDir, 'IndexedDB');

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
        messages.deleteAndRestart.message,
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

async function removeIndexedDBFiles() {
  if (!indexedDBPath) {
    throw new Error(
      'removeIndexedDBFiles: Need to initialize and set indexedDBPath first!'
    );
  }

  const pattern = path.join(indexedDBPath, '*.leveldb');
  rimraf.sync(pattern);
  indexedDBPath = null;
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
async function createOrUpdateIdentityKey(data) {
  return createOrUpdate(IDENTITY_KEYS_TABLE, data);
}
async function getIdentityKeyById(id) {
  return getById(IDENTITY_KEYS_TABLE, id);
}
async function bulkAddIdentityKeys(array) {
  return bulkAdd(IDENTITY_KEYS_TABLE, array);
}
async function removeIdentityKeyById(id) {
  return removeById(IDENTITY_KEYS_TABLE, id);
}
async function removeAllIdentityKeys() {
  return removeAllFromTable(IDENTITY_KEYS_TABLE);
}
async function getAllIdentityKeys() {
  return getAllFromTable(IDENTITY_KEYS_TABLE);
}

const PRE_KEYS_TABLE = 'preKeys';
async function createOrUpdatePreKey(data) {
  const { id, recipient } = data;
  if (!id) {
    throw new Error('createOrUpdate: Provided data did not have a truthy id');
  }

  await db.run(
    `INSERT OR REPLACE INTO ${PRE_KEYS_TABLE} (
      id,
      recipient,
      json
    ) values (
      $id,
      $recipient,
      $json
    )`,
    {
      $id: id,
      $recipient: recipient || '',
      $json: objectToJSON(data),
    }
  );
}
async function getPreKeyById(id) {
  return getById(PRE_KEYS_TABLE, id);
}
async function getPreKeyByRecipient(recipient) {
  const row = await db.get(
    `SELECT * FROM ${PRE_KEYS_TABLE} WHERE recipient = $recipient;`,
    {
      $recipient: recipient,
    }
  );

  if (!row) {
    return null;
  }

  return jsonToObject(row.json);
}
async function bulkAddPreKeys(array) {
  return bulkAdd(PRE_KEYS_TABLE, array);
}
async function removePreKeyById(id) {
  return removeById(PRE_KEYS_TABLE, id);
}
async function removeAllPreKeys() {
  return removeAllFromTable(PRE_KEYS_TABLE);
}
async function getAllPreKeys() {
  return getAllFromTable(PRE_KEYS_TABLE);
}

const CONTACT_PRE_KEYS_TABLE = 'contactPreKeys';
async function createOrUpdateContactPreKey(data) {
  const { keyId, identityKeyString } = data;

  await db.run(
    `INSERT OR REPLACE INTO ${CONTACT_PRE_KEYS_TABLE} (
      keyId,
      identityKeyString,
      json
    ) values (
      $keyId,
      $identityKeyString,
      $json
    )`,
    {
      $keyId: keyId,
      $identityKeyString: identityKeyString || '',
      $json: objectToJSON(data),
    }
  );
}
async function getContactPreKeyById(id) {
  return getById(CONTACT_PRE_KEYS_TABLE, id);
}
async function getContactPreKeyByIdentityKey(key) {
  const row = await db.get(
    `SELECT * FROM ${CONTACT_PRE_KEYS_TABLE} WHERE identityKeyString = $identityKeyString ORDER BY keyId DESC LIMIT 1;`,
    {
      $identityKeyString: key,
    }
  );

  if (!row) {
    return null;
  }

  return jsonToObject(row.json);
}
async function getContactPreKeys(keyId, identityKeyString) {
  const query = `SELECT * FROM ${CONTACT_PRE_KEYS_TABLE} WHERE identityKeyString = $identityKeyString AND keyId = $keyId;`;
  const rows = await db.all(query, {
    $keyId: keyId,
    $identityKeyString: identityKeyString,
  });
  return map(rows, row => jsonToObject(row.json));
}

async function bulkAddContactPreKeys(array) {
  return bulkAdd(CONTACT_PRE_KEYS_TABLE, array);
}
async function removeContactPreKeyByIdentityKey(key) {
  await db.run(
    `DELETE FROM ${CONTACT_PRE_KEYS_TABLE} WHERE identityKeyString = $identityKeyString;`,
    {
      $identityKeyString: key,
    }
  );
}
async function removeAllContactPreKeys() {
  return removeAllFromTable(CONTACT_PRE_KEYS_TABLE);
}

const CONTACT_SIGNED_PRE_KEYS_TABLE = 'contactSignedPreKeys';
async function createOrUpdateContactSignedPreKey(data) {
  const { keyId, identityKeyString } = data;

  await db.run(
    `INSERT OR REPLACE INTO ${CONTACT_SIGNED_PRE_KEYS_TABLE} (
      keyId,
      identityKeyString,
      json
    ) values (
      $keyId,
      $identityKeyString,
      $json
    )`,
    {
      $keyId: keyId,
      $identityKeyString: identityKeyString || '',
      $json: objectToJSON(data),
    }
  );
}
async function getContactSignedPreKeyById(id) {
  return getById(CONTACT_SIGNED_PRE_KEYS_TABLE, id);
}
async function getContactSignedPreKeyByIdentityKey(key) {
  const row = await db.get(
    `SELECT * FROM ${CONTACT_SIGNED_PRE_KEYS_TABLE} WHERE identityKeyString = $identityKeyString ORDER BY keyId DESC;`,
    {
      $identityKeyString: key,
    }
  );

  if (!row) {
    return null;
  }

  return jsonToObject(row.json);
}
async function getContactSignedPreKeys(keyId, identityKeyString) {
  const query = `SELECT * FROM ${CONTACT_SIGNED_PRE_KEYS_TABLE} WHERE identityKeyString = $identityKeyString AND keyId = $keyId;`;
  const rows = await db.all(query, {
    $keyId: keyId,
    $identityKeyString: identityKeyString,
  });
  return map(rows, row => jsonToObject(row.json));
}
async function bulkAddContactSignedPreKeys(array) {
  return bulkAdd(CONTACT_SIGNED_PRE_KEYS_TABLE, array);
}
async function removeContactSignedPreKeyByIdentityKey(key) {
  await db.run(
    `DELETE FROM ${CONTACT_SIGNED_PRE_KEYS_TABLE} WHERE identityKeyString = $identityKeyString;`,
    {
      $identityKeyString: key,
    }
  );
}
async function removeAllContactSignedPreKeys() {
  return removeAllFromTable(CONTACT_SIGNED_PRE_KEYS_TABLE);
}

const SIGNED_PRE_KEYS_TABLE = 'signedPreKeys';
async function createOrUpdateSignedPreKey(data) {
  return createOrUpdate(SIGNED_PRE_KEYS_TABLE, data);
}
async function getSignedPreKeyById(id) {
  return getById(SIGNED_PRE_KEYS_TABLE, id);
}
async function getAllSignedPreKeys() {
  const rows = await db.all('SELECT json FROM signedPreKeys ORDER BY id ASC;');
  return map(rows, row => jsonToObject(row.json));
}
async function getAllContactPreKeys() {
  const rows = await db.all('SELECT json FROM contactPreKeys ORDER BY id ASC;');
  return map(rows, row => jsonToObject(row.json));
}
async function bulkAddSignedPreKeys(array) {
  return bulkAdd(SIGNED_PRE_KEYS_TABLE, array);
}
async function removeSignedPreKeyById(id) {
  return removeById(SIGNED_PRE_KEYS_TABLE, id);
}
async function removeAllSignedPreKeys() {
  return removeAllFromTable(SIGNED_PRE_KEYS_TABLE);
}

const PAIRING_AUTHORISATIONS_TABLE = 'pairingAuthorisations';
async function getAuthorisationForSecondaryPubKey(pubKey, options) {
  const granted = options && options.granted;
  let filter = '';
  if (granted) {
    filter = 'AND isGranted = 1';
  }
  const row = await db.get(
    `SELECT json FROM ${PAIRING_AUTHORISATIONS_TABLE} WHERE secondaryDevicePubKey = $secondaryDevicePubKey ${filter};`,
    {
      $secondaryDevicePubKey: pubKey,
    }
  );

  if (!row) {
    return null;
  }

  return jsonToObject(row.json);
}

async function getGrantAuthorisationsForPrimaryPubKey(primaryDevicePubKey) {
  const rows = await db.all(
    `SELECT json FROM ${PAIRING_AUTHORISATIONS_TABLE} WHERE primaryDevicePubKey = $primaryDevicePubKey AND isGranted = 1 ORDER BY secondaryDevicePubKey ASC;`,
    {
      $primaryDevicePubKey: primaryDevicePubKey,
    }
  );
  return map(rows, row => jsonToObject(row.json));
}

async function createOrUpdatePairingAuthorisation(data) {
  const { primaryDevicePubKey, secondaryDevicePubKey, grantSignature } = data;

  await db.run(
    `INSERT OR REPLACE INTO ${PAIRING_AUTHORISATIONS_TABLE} (
      primaryDevicePubKey,
      secondaryDevicePubKey,
      isGranted,
      json
    ) values (
      $primaryDevicePubKey,
      $secondaryDevicePubKey,
      $isGranted,
      $json
    )`,
    {
      $primaryDevicePubKey: primaryDevicePubKey,
      $secondaryDevicePubKey: secondaryDevicePubKey,
      $isGranted: Boolean(grantSignature),
      $json: objectToJSON(data),
    }
  );
}

async function removePairingAuthorisationForSecondaryPubKey(pubKey) {
  await db.run(
    `DELETE FROM ${PAIRING_AUTHORISATIONS_TABLE} WHERE secondaryDevicePubKey = $secondaryDevicePubKey;`,
    {
      $secondaryDevicePubKey: pubKey,
    }
  );
}

async function getSecondaryDevicesFor(primaryDevicePubKey) {
  const authorisations = await getGrantAuthorisationsForPrimaryPubKey(
    primaryDevicePubKey
  );
  return map(authorisations, row => row.secondaryDevicePubKey);
}

async function getPrimaryDeviceFor(secondaryDevicePubKey) {
  const row = await db.get(
    `SELECT primaryDevicePubKey FROM ${PAIRING_AUTHORISATIONS_TABLE} WHERE secondaryDevicePubKey = $secondaryDevicePubKey AND isGranted = 1;`,
    {
      $secondaryDevicePubKey: secondaryDevicePubKey,
    }
  );

  if (!row) {
    return null;
  }

  return row.primaryDevicePubKey;
}

// Return all the paired pubkeys for a specific pubkey (excluded),
// irrespective of their Primary or Secondary status.
async function getPairedDevicesFor(pubKey) {
  let results = [];

  // get primary pubkey (only works if the pubkey is a secondary pubkey)
  const primaryPubKey = await getPrimaryDeviceFor(pubKey);
  if (primaryPubKey) {
    results.push(primaryPubKey);
  }
  // get secondary pubkeys (only works if the pubkey is a primary pubkey)
  const secondaryPubKeys = await getSecondaryDevicesFor(
    primaryPubKey || pubKey
  );
  results = results.concat(secondaryPubKeys);

  // ensure the input pubkey is not in the results
  results = results.filter(x => x !== pubKey);

  return results;
}

const ITEMS_TABLE = 'items';
async function createOrUpdateItem(data) {
  return createOrUpdate(ITEMS_TABLE, data);
}
async function getItemById(id) {
  return getById(ITEMS_TABLE, id);
}
async function getAllItems() {
  const rows = await db.all('SELECT json FROM items ORDER BY id ASC;');
  return map(rows, row => jsonToObject(row.json));
}
async function bulkAddItems(array) {
  return bulkAdd(ITEMS_TABLE, array);
}
async function removeItemById(id) {
  return removeById(ITEMS_TABLE, id);
}
async function removeAllItems() {
  return removeAllFromTable(ITEMS_TABLE);
}

const SESSIONS_TABLE = 'sessions';
async function createOrUpdateSession(data) {
  const { id, number } = data;
  if (!id) {
    throw new Error(
      'createOrUpdateSession: Provided data did not have a truthy id'
    );
  }
  if (!number) {
    throw new Error(
      'createOrUpdateSession: Provided data did not have a truthy number'
    );
  }

  await db.run(
    `INSERT OR REPLACE INTO sessions (
      id,
      number,
      json
    ) values (
      $id,
      $number,
      $json
    )`,
    {
      $id: id,
      $number: number,
      $json: objectToJSON(data),
    }
  );
}
async function getSessionById(id) {
  return getById(SESSIONS_TABLE, id);
}
async function getSessionsByNumber(number) {
  const rows = await db.all('SELECT * FROM sessions WHERE number = $number;', {
    $number: number,
  });
  return map(rows, row => jsonToObject(row.json));
}
async function bulkAddSessions(array) {
  return bulkAdd(SESSIONS_TABLE, array);
}
async function removeSessionById(id) {
  return removeById(SESSIONS_TABLE, id);
}
async function removeSessionsByNumber(number) {
  await db.run('DELETE FROM sessions WHERE number = $number;', {
    $number: number,
  });
}
async function removeAllSessions() {
  return removeAllFromTable(SESSIONS_TABLE);
}
async function getAllSessions() {
  return getAllFromTable(SESSIONS_TABLE);
}

async function createOrUpdate(table, data) {
  const { id } = data;
  if (!id) {
    throw new Error('createOrUpdate: Provided data did not have a truthy id');
  }

  await db.run(
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

async function bulkAdd(table, array) {
  let promise;

  db.serialize(() => {
    promise = Promise.all([
      db.run('BEGIN TRANSACTION;'),
      ...map(array, data => createOrUpdate(table, data)),
      db.run('COMMIT TRANSACTION;'),
    ]);
  });

  await promise;
}

async function getById(table, id) {
  const row = await db.get(`SELECT * FROM ${table} WHERE id = $id;`, {
    $id: id,
  });

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

async function getAllFromTable(table) {
  const rows = await db.all(`SELECT json FROM ${table};`);
  return rows.map(row => jsonToObject(row.json));
}

// Conversations

async function getSwarmNodesByPubkey(pubkey) {
  const row = await db.get('SELECT * FROM conversations WHERE id = $pubkey;', {
    $pubkey: pubkey,
  });

  if (!row) {
    return [];
  }

  return jsonToObject(row.json).swarmNodes;
}

const CONVERSATIONS_TABLE = 'conversations';
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
    friendRequestStatus,
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
    friendRequestStatus,
    profileName
  ) values (
    $id,
    $json,

    $active_at,
    $type,
    $members,
    $name,
    $friendRequestStatus,
    $profileName
  );`,
    {
      $id: id,
      $json: objectToJSON(data),

      $active_at: active_at,
      $type: type,
      $members: members ? members.join(' ') : null,
      $name: name,
      $friendRequestStatus: friendRequestStatus,
      $profileName: profileName,
    }
  );
}

async function saveConversations(arrayOfConversations) {
  let promise;

  db.serialize(() => {
    promise = Promise.all([
      db.run('BEGIN TRANSACTION;'),
      ...map(arrayOfConversations, conversation =>
        saveConversation(conversation)
      ),
      db.run('COMMIT TRANSACTION;'),
    ]);
  });

  await promise;
}

async function updateConversation(data) {
  const {
    id,
    // eslint-disable-next-line camelcase
    active_at,
    type,
    members,
    name,
    friendRequestStatus,
    profileName,
  } = data;

  await db.run(
    `UPDATE ${CONVERSATIONS_TABLE} SET
    json = $json,

    active_at = $active_at,
    type = $type,
    members = $members,
    name = $name,
    friendRequestStatus = $friendRequestStatus,
    profileName = $profileName
  WHERE id = $id;`,
    {
      $id: id,
      $json: objectToJSON(data),

      $active_at: active_at,
      $type: type,
      $members: members ? members.join(' ') : null,
      $name: name,
      $friendRequestStatus: friendRequestStatus,
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

async function savePublicServerToken(data) {
  const { serverUrl, token } = data;
  await db.run(
    `INSERT OR REPLACE INTO servers (
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

async function getPublicServerTokenByServerUrl(serverUrl) {
  const row = await db.get(
    'SELECT * FROM servers WHERE serverUrl = $serverUrl;',
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

async function getPubKeysWithFriendStatus(status) {
  const rows = await db.all(
    `SELECT id FROM ${CONVERSATIONS_TABLE} WHERE
      friendRequestStatus = $status
      AND type = 'private'
    ORDER BY id ASC;`,
    {
      $status: status,
    }
  );
  return map(rows, row => row.id);
}

async function getConversationsWithFriendStatus(status) {
  const rows = await db.all(
    `SELECT * FROM ${CONVERSATIONS_TABLE} WHERE
      friendRequestStatus = $status
      AND type = 'private'
    ORDER BY id ASC;`,
    {
      $status: status,
    }
  );
  return map(rows, row => jsonToObject(row.json));
}

async function getAllConversationIds() {
  const rows = await db.all(
    `SELECT id FROM ${CONVERSATIONS_TABLE} ORDER BY id ASC;`
  );
  return map(rows, row => row.id);
}

async function getAllPrivateConversations() {
  const rows = await db.all(
    `SELECT json FROM ${CONVERSATIONS_TABLE} WHERE
      type = 'private'
     ORDER BY id ASC;`
  );

  return map(rows, row => jsonToObject(row.json));
}

async function getAllRssFeedConversations() {
  const rows = await db.all(
    `SELECT json FROM conversations WHERE
      type = 'group' AND
      id LIKE 'rss://%'
     ORDER BY id ASC;`
  );

  return map(rows, row => jsonToObject(row.json));
}

async function getAllPublicConversations() {
  const rows = await db.all(
    `SELECT json FROM conversations WHERE
      type = 'group' AND
      id LIKE 'publicChat:%'
     ORDER BY id ASC;`
  );

  return map(rows, row => jsonToObject(row.json));
}

async function getPublicConversationsByServer(server) {
  const rows = await db.all(
    `SELECT * FROM conversations WHERE
      server = $server
     ORDER BY id ASC;`,
    {
      $server: server,
    }
  );

  return map(rows, row => jsonToObject(row.json));
}

async function getPubkeysInPublicConversation(id) {
  const rows = await db.all(
    `SELECT DISTINCT source FROM messages WHERE
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
  const row = await db.get('SELECT count(*) from messages;');

  if (!row) {
    throw new Error('getMessageCount: Unable to get count of messages');
  }

  return row['count(*)'];
}

async function saveMessage(data, { forceSave } = {}) {
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

  const payload = {
    $id: id,
    $json: objectToJSON(data),

    $serverId: serverId,
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

  if (id && !forceSave) {
    await db.run(
      `UPDATE messages SET
        json = $json,
        serverId = $serverId,
        body = $body,
        conversationId = $conversationId,
        expirationStartTimestamp = $expirationStartTimestamp,
        expires_at = $expires_at,
        expireTimer = $expireTimer,
        hasAttachments = $hasAttachments,
        hasFileAttachments = $hasFileAttachments,
        hasVisualMediaAttachments = $hasVisualMediaAttachments,
        id = $id,
        received_at = $received_at,
        schemaVersion = $schemaVersion,
        sent = $sent,
        sent_at = $sent_at,
        source = $source,
        sourceDevice = $sourceDevice,
        type = $type,
        unread = $unread
      WHERE id = $id;`,
      payload
    );

    return id;
  }

  const toCreate = {
    ...data,
    id: id || generateUUID(),
  };

  await db.run(
    `INSERT INTO messages (
    id,
    json,

    serverId,
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
      $id: toCreate.id,
      $json: objectToJSON(toCreate),
    }
  );

  return toCreate.id;
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
  const { snode, hash, expiresAt } = data;

  await db.run(
    `INSERT OR REPLACE INTO lastHashes (
      snode,
      hash,
      expiresAt
    ) values (
      $snode,
      $hash,
      $expiresAt
    )`,
    {
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

async function saveMessages(arrayOfMessages, { forceSave } = {}) {
  let promise;

  db.serialize(() => {
    promise = Promise.all([
      db.run('BEGIN TRANSACTION;'),
      ...map(arrayOfMessages, message => saveMessage(message, { forceSave })),
      db.run('COMMIT TRANSACTION;'),
    ]);
  });

  await promise;
}

async function removeMessage(id) {
  if (!Array.isArray(id)) {
    await db.run('DELETE FROM messages WHERE id = $id;', { $id: id });
    return;
  }

  if (!id.length) {
    throw new Error('removeMessages: No ids to delete!');
  }

  // Our node interface doesn't seem to allow you to replace one single ? with an array
  await db.run(
    `DELETE FROM messages WHERE id IN ( ${id.map(() => '?').join(', ')} );`,
    id
  );
}

async function getMessageByServerId(serverId, conversationId) {
  const row = await db.get(
    `SELECT * FROM messages WHERE
      serverId = $serverId AND
      conversationId = $conversationId;`,
    {
      $serverId: serverId,
      $conversationId: conversationId,
    }
  );

  if (!row) {
    return null;
  }

  return jsonToObject(row.json);
}

async function getMessageById(id) {
  const row = await db.get('SELECT * FROM messages WHERE id = $id;', {
    $id: id,
  });

  if (!row) {
    return null;
  }

  return jsonToObject(row.json);
}

async function getAllMessages() {
  const rows = await db.all('SELECT json FROM messages ORDER BY id ASC;');
  return map(rows, row => jsonToObject(row.json));
}

async function getAllMessageIds() {
  const rows = await db.all('SELECT id FROM messages ORDER BY id ASC;');
  return map(rows, row => row.id);
}

// eslint-disable-next-line camelcase
async function getMessageBySender({ source, sourceDevice, sent_at }) {
  const rows = await db.all(
    `SELECT json FROM messages WHERE
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

async function getAllUnsentMessages() {
  const rows = await db.all(`
    SELECT json FROM messages WHERE
      type IN ('outgoing', 'friend-request') AND
      NOT sent
    ORDER BY sent_at DESC;
  `);
  return map(rows, row => jsonToObject(row.json));
}

async function getUnreadByConversation(conversationId) {
  const rows = await db.all(
    `SELECT json FROM messages WHERE
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

// Note: Sorting here is necessary for getting the last message (with limit 1)
async function getMessagesByConversation(
  conversationId,
  { limit = 100, receivedAt = Number.MAX_VALUE, type = '%' } = {}
) {
  const rows = await db.all(
    `
    SELECT json FROM messages WHERE
      conversationId = $conversationId AND
      received_at < $received_at AND
      type LIKE $type
    ORDER BY sent_at DESC
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
    `SELECT * FROM messages
     WHERE sent_at = $sent_at
     ORDER BY received_at DESC;`,
    {
      $sent_at: sentAt,
    }
  );

  return map(rows, row => jsonToObject(row.json));
}

async function getLastHashBySnode(snode) {
  const row = await db.get('SELECT * FROM lastHashes WHERE snode = $snode;', {
    $snode: snode,
  });

  if (!row) {
    return null;
  }

  return row.lastHash;
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
    `SELECT json FROM messages WHERE
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
    SELECT json FROM messages
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
    SELECT json FROM messages
    WHERE expires_at > 0
    ORDER BY expires_at ASC
    LIMIT 1;
  `);

  return map(rows, row => jsonToObject(row.json));
}

async function saveUnprocessed(data, { forceSave } = {}) {
  const { id, timestamp, version, attempts, envelope } = data;
  if (!id) {
    throw new Error('saveUnprocessed: id was falsey');
  }

  if (forceSave) {
    await db.run(
      `INSERT INTO unprocessed (
        id,
        timestamp,
        version,
        attempts,
        envelope
      ) values (
        $id,
        $timestamp,
        $version,
        $attempts,
        $envelope
      );`,
      {
        $id: id,
        $timestamp: timestamp,
        $version: version,
        $attempts: attempts,
        $envelope: envelope,
      }
    );

    return id;
  }

  await db.run(
    `UPDATE unprocessed SET
      timestamp = $timestamp,
      version = $version,
      attempts = $attempts,
      envelope = $envelope
    WHERE id = $id;`,
    {
      $id: id,
      $timestamp: timestamp,
      $version: version,
      $attempts: attempts,
      $envelope: envelope,
    }
  );

  return id;
}

async function saveUnprocesseds(arrayOfUnprocessed, { forceSave } = {}) {
  let promise;

  db.serialize(() => {
    promise = Promise.all([
      db.run('BEGIN TRANSACTION;'),
      ...map(arrayOfUnprocessed, unprocessed =>
        saveUnprocessed(unprocessed, { forceSave })
      ),
      db.run('COMMIT TRANSACTION;'),
    ]);
  });

  await promise;
}

async function updateUnprocessedAttempts(id, attempts) {
  await db.run('UPDATE unprocessed SET attempts = $attempts WHERE id = $id;', {
    $id: id,
    $attempts: attempts,
  });
}
async function updateUnprocessedWithData(id, data = {}) {
  const { source, sourceDevice, serverTimestamp, decrypted } = data;

  await db.run(
    `UPDATE unprocessed SET
      source = $source,
      sourceDevice = $sourceDevice,
      serverTimestamp = $serverTimestamp,
      decrypted = $decrypted
    WHERE id = $id;`,
    {
      $id: id,
      $source: source,
      $sourceDevice: sourceDevice,
      $serverTimestamp: serverTimestamp,
      $decrypted: decrypted,
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
      db.run('DELETE FROM conversations;'),
      db.run('DELETE FROM identityKeys;'),
      db.run('DELETE FROM items;'),
      db.run('DELETE FROM messages;'),
      db.run('DELETE FROM preKeys;'),
      db.run('DELETE FROM sessions;'),
      db.run('DELETE FROM signedPreKeys;'),
      db.run('DELETE FROM unprocessed;'),
      db.run('DELETE FROM contactPreKeys;'),
      db.run('DELETE FROM contactSignedPreKeys;'),
      db.run('DELETE FROM attachment_downloads;'),
      db.run('DELETE FROM messages_fts;'),
      db.run('COMMIT TRANSACTION;'),
    ]);
  });

  await promise;
}

// Anything that isn't user-visible data
async function removeAllConfiguration() {
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
      db.run('COMMIT TRANSACTION;'),
    ]);
  });

  await promise;
}

async function removeAllConversations() {
  await removeAllFromTable(CONVERSATIONS_TABLE);
}

async function removeAllPrivateConversations() {
  await db.run(`DELETE FROM ${CONVERSATIONS_TABLE} WHERE type = 'private'`);
}

async function getMessagesNeedingUpgrade(limit, { maxVersion }) {
  const rows = await db.all(
    `SELECT json FROM messages
     WHERE schemaVersion IS NULL OR schemaVersion < $maxVersion
     LIMIT $limit;`,
    {
      $maxVersion: maxVersion,
      $limit: limit,
    }
  );

  return map(rows, row => jsonToObject(row.json));
}

async function getMessagesWithVisualMediaAttachments(
  conversationId,
  { limit }
) {
  const rows = await db.all(
    `SELECT json FROM messages WHERE
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
    `SELECT json FROM messages WHERE
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
      `SELECT json FROM messages
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
      `SELECT json FROM conversations
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

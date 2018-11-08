const path = require('path');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const sql = require('@journeyapps/sqlcipher');
const pify = require('pify');
const uuidv4 = require('uuid/v4');
const { map, isString, fromPairs, forEach, last } = require('lodash');

// To get long stack traces
//   https://github.com/mapbox/node-sqlite3/wiki/API#sqlite3verbose
sql.verbose();

module.exports = {
  initialize,
  close,
  removeDB,
  removeIndexedDBFiles,

  createOrUpdateGroup,
  getGroupById,
  getAllGroupIds,
  bulkAddGroups,
  removeGroupById,
  removeAllGroups,

  createOrUpdateIdentityKey,
  getIdentityKeyById,
  bulkAddIdentityKeys,
  removeIdentityKeyById,
  removeAllIdentityKeys,

  createOrUpdatePreKey,
  getPreKeyById,
  getPreKeyByRecipient,
  bulkAddPreKeys,
  removePreKeyById,
  removeAllPreKeys,

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
  removeContactPreKeyById,
  removeAllContactPreKeys,

  createOrUpdateContactSignedPreKey,
  getContactSignedPreKeyById,
  getContactSignedPreKeyByIdentityKey,
  getContactSignedPreKeys,
  bulkAddContactSignedPreKeys,
  removeContactSignedPreKeyById,
  removeAllContactSignedPreKeys,

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

  getConversationCount,
  saveConversation,
  saveConversations,
  getConversationById,
  updateConversation,
  removeConversation,
  getAllConversations,
  getAllConversationIds,
  getAllPrivateConversations,
  getAllGroupsInvolvingId,
  searchConversations,

  getMessageCount,
  saveMessage,
  saveMessages,
  removeMessage,
  getUnreadByConversation,
  getMessageBySender,
  getMessageById,
  getAllMessages,
  getAllMessageIds,
  getMessagesBySentAt,
  getExpiredMessages,
  getOutgoingWithoutExpiresAt,
  getNextExpiringMessage,
  getMessagesByConversation,

  getUnprocessedCount,
  getAllUnprocessed,
  saveUnprocessed,
  getUnprocessedById,
  saveUnprocesseds,
  removeUnprocessed,
  removeAllUnprocessed,

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

const INVALID_KEY = /[^0-9A-Fa-f]/;
async function setupSQLCipher(instance, { key }) {
  const match = INVALID_KEY.exec(key);
  if (match) {
    throw new Error(`setupSQLCipher: key '${key}' is not valid`);
  }

  // https://www.zetetic.net/sqlcipher/sqlcipher-api/#key
  await instance.run(`PRAGMA key = "x'${key}'";`);
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

  await instance.run(
    `CREATE TABLE contactSignedPreKeys(
      id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      identityKeyString VARCHAR(255),
      keyId INTEGER,
      json TEXT
    );`
  );

  await instance.run('PRAGMA schema_version = 6;');
  await instance.run('COMMIT TRANSACTION;');
  console.log('updateToSchemaVersion6: success!');
}

const SCHEMA_VERSIONS = [
  updateToSchemaVersion1,
  updateToSchemaVersion2,
  updateToSchemaVersion3,
  updateToSchemaVersion4,
  // version 5 was dropped
  updateToSchemaVersion6,
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
}

let db;
let filePath;
let indexedDBPath;

async function initialize({ configDir, key }) {
  if (db) {
    throw new Error('Cannot initialize more than once!');
  }

  if (!isString(configDir)) {
    throw new Error('initialize: configDir is required!');
  }
  if (!isString(key)) {
    throw new Error('initialize: key` is required!');
  }

  indexedDBPath = path.join(configDir, 'IndexedDB');

  const dbDir = path.join(configDir, 'sql');
  mkdirp.sync(dbDir);

  filePath = path.join(dbDir, 'db.sqlite');

  const sqlInstance = await openDatabase(filePath);
  const promisified = promisify(sqlInstance);

  // promisified.on('trace', async statement => {
  //   if (!db) {
  //     console._log(statement);
  //     return;
  //   }
  //   const data = await db.get(`EXPLAIN QUERY PLAN ${statement}`);
  //   console._log(`EXPLAIN QUERY PLAN ${statement}\n`, data && data.detail);
  // });

  await setupSQLCipher(promisified, { key });
  await updateSchema(promisified);

  db = promisified;
}

async function close() {
  const dbRef = db;
  db = null;
  await dbRef.close();
}

async function removeDB() {
  if (db) {
    throw new Error('removeDB: Cannot erase database when it is open!');
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

const GROUPS_TABLE = 'groups';
async function createOrUpdateGroup(data) {
  return createOrUpdate(GROUPS_TABLE, data);
}
async function getGroupById(id) {
  return getById(GROUPS_TABLE, id);
}
async function getAllGroupIds() {
  const rows = await db.all('SELECT id FROM groups ORDER BY id ASC;');
  return map(rows, row => row.id);
}
async function bulkAddGroups(array) {
  return bulkAdd(GROUPS_TABLE, array);
}
async function removeGroupById(id) {
  return removeById(GROUPS_TABLE, id);
}
async function removeAllGroups() {
  return removeAllFromTable(GROUPS_TABLE);
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
  const row = await db.get(`SELECT * FROM ${PRE_KEYS_TABLE} WHERE recipient = $recipient;`, {
    $recipient: recipient,
  });

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
  const row = await db.get(`SELECT * FROM ${CONTACT_PRE_KEYS_TABLE} WHERE identityKeyString = $identityKeyString;`, {
    $identityKeyString: key,
  });

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
async function removeContactPreKeyById(id) {
  return removeById(CONTACT_PRE_KEYS_TABLE, id);
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
  const row = await db.get(`SELECT * FROM ${CONTACT_SIGNED_PRE_KEYS_TABLE} WHERE identityKeyString = $identityKeyString;`, {
    $identityKeyString: key,
  });

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
async function removeContactSignedPreKeyById(id) {
  return removeById(CONTACT_SIGNED_PRE_KEYS_TABLE, id);
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

// Conversations

async function getConversationCount() {
  const row = await db.get('SELECT count(*) from conversations;');

  if (!row) {
    throw new Error('getMessageCount: Unable to get count of conversations');
  }

  return row['count(*)'];
}

async function saveConversation(data) {
  // eslint-disable-next-line camelcase
  const { id, active_at, type, members, name, profileName } = data;

  await db.run(
    `INSERT INTO conversations (
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
  // eslint-disable-next-line camelcase
  const { id, active_at, type, members, name, profileName } = data;

  await db.run(
    `UPDATE conversations SET
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
    await db.run('DELETE FROM conversations WHERE id = $id;', { $id: id });
    return;
  }

  if (!id.length) {
    throw new Error('removeConversation: No ids to delete!');
  }

  // Our node interface doesn't seem to allow you to replace one single ? with an array
  await db.run(
    `DELETE FROM conversations WHERE id IN ( ${id
      .map(() => '?')
      .join(', ')} );`,
    id
  );
}

async function getConversationById(id) {
  const row = await db.get('SELECT * FROM conversations WHERE id = $id;', {
    $id: id,
  });

  if (!row) {
    return null;
  }

  return jsonToObject(row.json);
}

async function getAllConversations() {
  const rows = await db.all('SELECT json FROM conversations ORDER BY id ASC;');
  return map(rows, row => jsonToObject(row.json));
}

async function getAllConversationIds() {
  const rows = await db.all('SELECT id FROM conversations ORDER BY id ASC;');
  return map(rows, row => row.id);
}

async function getAllPrivateConversations() {
  const rows = await db.all(
    `SELECT json FROM conversations WHERE
      type = 'private'
     ORDER BY id ASC;`
  );

  return map(rows, row => jsonToObject(row.json));
}

async function getAllGroupsInvolvingId(id) {
  const rows = await db.all(
    `SELECT json FROM conversations WHERE
      type = 'group' AND
      members LIKE $id
     ORDER BY id ASC;`,
    {
      $id: `%${id}%`,
    }
  );

  return map(rows, row => jsonToObject(row.json));
}

async function searchConversations(query) {
  const rows = await db.all(
    `SELECT json FROM conversations WHERE
      id LIKE $id OR
      name LIKE $name OR
      profileName LIKE $profileName
     ORDER BY id ASC;`,
    {
      $id: `%${query}%`,
      $name: `%${query}%`,
      $profileName: `%${query}%`,
    }
  );

  return map(rows, row => jsonToObject(row.json));
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
    conversationId,
    // eslint-disable-next-line camelcase
    expires_at,
    hasAttachments,
    hasFileAttachments,
    hasVisualMediaAttachments,
    id,
    // eslint-disable-next-line camelcase
    received_at,
    schemaVersion,
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

    $conversationId: conversationId,
    $expirationStartTimestamp: expirationStartTimestamp,
    $expires_at: expires_at,
    $expireTimer: expireTimer,
    $hasAttachments: hasAttachments,
    $hasFileAttachments: hasFileAttachments,
    $hasVisualMediaAttachments: hasVisualMediaAttachments,
    $received_at: received_at,
    $schemaVersion: schemaVersion,
    $sent_at: sent_at,
    $source: source,
    $sourceDevice: sourceDevice,
    $type: type,
    $unread: unread,
  };

  if (id && !forceSave) {
    await db.run(
      `UPDATE messages SET
        json = $json,
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

    conversationId,
    expirationStartTimestamp,
    expires_at,
    expireTimer,
    hasAttachments,
    hasFileAttachments,
    hasVisualMediaAttachments,
    received_at,
    schemaVersion,
    sent_at,
    source,
    sourceDevice,
    type,
    unread
  ) values (
    $id,
    $json,

    $conversationId,
    $expirationStartTimestamp,
    $expires_at,
    $expireTimer,
    $hasAttachments,
    $hasFileAttachments,
    $hasVisualMediaAttachments,
    $received_at,
    $schemaVersion,
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

async function getMessagesByConversation(
  conversationId,
  { limit = 100, receivedAt = Number.MAX_VALUE } = {}
) {
  const rows = await db.all(
    `SELECT json FROM messages WHERE
       conversationId = $conversationId AND
       received_at < $received_at
     ORDER BY received_at DESC
     LIMIT $limit;`,
    {
      $conversationId: conversationId,
      $received_at: receivedAt,
      $limit: limit,
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
  const { id, timestamp } = data;

  if (forceSave) {
    await db.run(
      `INSERT INTO unprocessed (
        id,
        timestamp,
        json
      ) values (
        $id,
        $timestamp,
        $json
      );`,
      {
        $id: id,
        $timestamp: timestamp,
        $json: objectToJSON(data),
      }
    );

    return id;
  }

  await db.run(
    `UPDATE unprocessed SET
      json = $json,
      timestamp = $timestamp
    WHERE id = $id;`,
    {
      $id: id,
      $timestamp: timestamp,
      $json: objectToJSON(data),
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

async function getUnprocessedById(id) {
  const row = await db.get('SELECT json FROM unprocessed WHERE id = $id;', {
    $id: id,
  });

  if (!row) {
    return null;
  }

  return jsonToObject(row.json);
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
    'SELECT json FROM unprocessed ORDER BY timestamp ASC;'
  );

  return map(rows, row => jsonToObject(row.json));
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

// All data in database
async function removeAll() {
  let promise;

  db.serialize(() => {
    promise = Promise.all([
      db.run('BEGIN TRANSACTION;'),
      db.run('DELETE FROM conversations;'),
      db.run('DELETE FROM groups;'),
      db.run('DELETE FROM identityKeys;'),
      db.run('DELETE FROM items;'),
      db.run('DELETE FROM messages;'),
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
  const { attachments, contact, quote } = message;
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

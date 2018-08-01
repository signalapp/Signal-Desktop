const path = require('path');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const sql = require('@journeyapps/sqlcipher');
const pify = require('pify');
const uuidv4 = require('uuid/v4');
const { map, isString } = require('lodash');

// To get long stack traces
//   https://github.com/mapbox/node-sqlite3/wiki/API#sqlite3verbose
sql.verbose();

module.exports = {
  initialize,
  close,
  removeDB,

  saveMessage,
  saveMessages,
  removeMessage,
  getUnreadByConversation,
  getMessageBySender,
  getMessageById,
  getAllMessageIds,
  getMessagesBySentAt,
  getExpiredMessages,
  getNextExpiringMessage,
  getMessagesByConversation,

  getAllUnprocessed,
  saveUnprocessed,
  getUnprocessedById,
  saveUnprocesseds,
  removeUnprocessed,
  removeAllUnprocessed,

  removeAll,

  getMessagesNeedingUpgrade,
  getMessagesWithVisualMediaAttachments,
  getMessagesWithFileAttachments,
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

const SCHEMA_VERSIONS = [updateToSchemaVersion1];

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

  const dbDir = path.join(configDir, 'sql');
  mkdirp.sync(dbDir);

  filePath = path.join(dbDir, 'db.sqlite');
  const sqlInstance = await openDatabase(filePath);
  const promisified = promisify(sqlInstance);

  // promisified.on('trace', statement => console._log(statement));

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
    unread,
  } = data;

  if (id && !forceSave) {
    await db.run(
      `UPDATE messages SET
        json = $json,
        conversationId = $conversationId,
        expires_at = $expires_at,
        hasAttachments = $hasAttachments,
        hasFileAttachments = $hasFileAttachments,
        hasVisualMediaAttachments = $hasVisualMediaAttachments,
        id = $id,
        received_at = $received_at,
        schemaVersion = $schemaVersion,
        sent_at = $sent_at,
        source = $source,
        sourceDevice = $sourceDevice,
        unread = $unread
      WHERE id = $id;`,
      {
        $id: id,
        $json: objectToJSON(data),

        $conversationId: conversationId,
        $expires_at: expires_at,
        $hasAttachments: hasAttachments,
        $hasFileAttachments: hasFileAttachments,
        $hasVisualMediaAttachments: hasVisualMediaAttachments,
        $received_at: received_at,
        $schemaVersion: schemaVersion,
        $sent_at: sent_at,
        $source: source,
        $sourceDevice: sourceDevice,
        $unread: unread,
      }
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
    expires_at,
    hasAttachments,
    hasFileAttachments,
    hasVisualMediaAttachments,
    received_at,
    schemaVersion,
    sent_at,
    source,
    sourceDevice,
    unread
  ) values (
    $id,
    $json,

    $conversationId,
    $expires_at,
    $hasAttachments,
    $hasFileAttachments,
    $hasVisualMediaAttachments,
    $received_at,
    $schemaVersion,
    $sent_at,
    $source,
    $sourceDevice,
    $unread
  );`,
    {
      $id: toCreate.id,
      $json: objectToJSON(toCreate),

      $conversationId: conversationId,
      $expires_at: expires_at,
      $hasAttachments: hasAttachments,
      $hasFileAttachments: hasFileAttachments,
      $hasVisualMediaAttachments: hasVisualMediaAttachments,
      $received_at: received_at,
      $schemaVersion: schemaVersion,
      $sent_at: sent_at,
      $source: source,
      $sourceDevice: sourceDevice,
      $unread: unread,
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

async function getAllMessageIds() {
  const rows = await db.all('SELECT id FROM messages ORDER BY id ASC;');
  return map(rows, row => row.id);
}

// eslint-disable-next-line camelcase
async function getMessageBySender({ source, sourceDevice, sent_at }) {
  const rows = db.all(
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
      conversationId = $conversationId AND
      unread = $unread
     ORDER BY received_at DESC;`,
    {
      $conversationId: conversationId,
      $unread: 1,
    }
  );

  if (!rows) {
    return null;
  }

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

  if (!rows) {
    return null;
  }

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

  if (!rows) {
    return null;
  }

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

  if (!rows) {
    return null;
  }

  return map(rows, row => jsonToObject(row.json));
}

async function getNextExpiringMessage() {
  const rows = await db.all(`
    SELECT json FROM messages
    WHERE expires_at IS NOT NULL
    ORDER BY expires_at ASC
    LIMIT 1;
  `);

  if (!rows) {
    return null;
  }

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

async function getAllUnprocessed() {
  const rows = await db.all(
    'SELECT json FROM unprocessed ORDER BY timestamp ASC;'
  );

  if (!rows) {
    return null;
  }

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

async function removeAll() {
  let promise;

  db.serialize(() => {
    promise = Promise.all([
      db.run('BEGIN TRANSACTION;'),
      db.run('DELETE FROM messages;'),
      db.run('DELETE FROM unprocessed;'),
      db.run('COMMIT TRANSACTION;'),
    ]);
  });

  await promise;
}

async function getMessagesNeedingUpgrade(limit, { maxVersion }) {
  const rows = await db.all(
    `SELECT json FROM messages
     WHERE schemaVersion IS NOT $maxVersion
     LIMIT $limit;`,
    {
      $maxVersion: maxVersion,
      $limit: limit,
    }
  );

  if (!rows) {
    return null;
  }

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

  if (!rows) {
    return null;
  }

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

  if (!rows) {
    return null;
  }

  return map(rows, row => jsonToObject(row.json));
}

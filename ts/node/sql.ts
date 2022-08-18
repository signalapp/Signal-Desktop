import path from 'path';
import fs from 'fs';
import rimraf from 'rimraf';
import * as BetterSqlite3 from 'better-sqlite3';
import { app, clipboard, dialog, Notification } from 'electron';

import {
  chunk,
  difference,
  forEach,
  fromPairs,
  isEmpty,
  isNumber,
  isObject,
  isString,
  last,
  map,
} from 'lodash';
import { redactAll } from '../util/privacy'; // checked - only node
import { LocaleMessagesType } from './locale'; // checked - only node
import { PubKey } from '../session/types/PubKey'; // checked - only node
import { StorageItem } from './storage_item'; // checked - only node
import { ConversationAttributes } from '../models/conversationAttributes';
import {
  arrayStrToJson,
  assertValidConversationAttributes,
  ATTACHMENT_DOWNLOADS_TABLE,
  CLOSED_GROUP_V2_KEY_PAIRS_TABLE,
  CONVERSATIONS_TABLE,
  dropFtsAndTriggers,
  formatRowOfConversation,
  GUARD_NODE_TABLE,
  HEX_KEY,
  IDENTITY_KEYS_TABLE,
  ITEMS_TABLE,
  jsonToObject,
  LAST_HASHES_TABLE,
  MESSAGES_FTS_TABLE,
  MESSAGES_TABLE,
  NODES_FOR_PUBKEY_TABLE,
  objectToJSON,
  OPEN_GROUP_ROOMS_V2_TABLE,
  rebuildFtsTable,
  toSqliteBoolean,
} from './database_utility';

import { UpdateLastHashType } from '../types/sqlSharedTypes';
import { OpenGroupV2Room } from '../data/opengroups';

import {
  getSQLCipherIntegrityCheck,
  openAndMigrateDatabase,
  updateSchema,
} from './migration/signalMigrations';

// tslint:disable: no-console function-name non-literal-fs-path

const MAX_PUBKEYS_MEMBERS = 300;

function getSQLIntegrityCheck(db: BetterSqlite3.Database) {
  const checkResult = db.pragma('quick_check', { simple: true });
  if (checkResult !== 'ok') {
    return checkResult;
  }

  return undefined;
}

function openAndSetUpSQLCipher(filePath: string, { key }: { key: string }) {
  return openAndMigrateDatabase(filePath, key);
}

function setSQLPassword(password: string) {
  if (!globalInstance) {
    throw new Error('setSQLPassword: db is not initialized');
  }

  // If the password isn't hex then we need to derive a key from it
  const deriveKey = HEX_KEY.test(password);
  const value = deriveKey ? `'${password}'` : `"x'${password}'"`;
  globalInstance.pragma(`rekey = ${value}`);
}

function vacuumDatabase(db: BetterSqlite3.Database) {
  if (!db) {
    throw new Error('vacuum: db is not initialized');
  }
  const start = Date.now();
  console.info('Vacuuming DB. This might take a while.');
  db.exec('VACUUM;');
  console.info(`Vacuuming DB Finished in ${Date.now() - start}ms.`);
}

let globalInstance: BetterSqlite3.Database | null = null;

function assertGlobalInstance(): BetterSqlite3.Database {
  if (!globalInstance) {
    throw new Error('globalInstance is not initialized.');
  }
  return globalInstance;
}

function assertGlobalInstanceOrInstance(
  instance?: BetterSqlite3.Database | null
): BetterSqlite3.Database {
  // if none of them are initialized, throw
  if (!globalInstance && !instance) {
    throw new Error('neither globalInstance nor initialized is initialized.');
  }
  // otherwise, return which ever is true, priority to the global one
  return globalInstance || (instance as BetterSqlite3.Database);
}

let databaseFilePath: string | undefined;

function _initializePaths(configDir: string) {
  const dbDir = path.join(configDir, 'sql');
  fs.mkdirSync(dbDir, { recursive: true });
  console.info('Made sure db folder exists at:', dbDir);
  databaseFilePath = path.join(dbDir, 'db.sqlite');
}

function showFailedToStart() {
  const notification = new Notification({
    title: 'Session failed to start',
    body: 'Please start from terminal and open a github issue',
  });
  notification.show();
}

async function initializeSql({
  configDir,
  key,
  messages,
  passwordAttempt,
}: {
  configDir: string;
  key: string;
  messages: LocaleMessagesType;
  passwordAttempt: boolean;
}) {
  console.info('initializeSql sqlnode');
  if (globalInstance) {
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

  let db;
  try {
    if (!databaseFilePath) {
      throw new Error('databaseFilePath is not set');
    }
    db = openAndSetUpSQLCipher(databaseFilePath, { key });
    if (!db) {
      throw new Error('db is not set');
    }
    updateSchema(db);

    // test database

    const cipherIntegrityResult = getSQLCipherIntegrityCheck(db);
    if (cipherIntegrityResult) {
      console.log('Database cipher integrity check failed:', cipherIntegrityResult);
      throw new Error(`Cipher integrity check failed: ${cipherIntegrityResult}`);
    }
    const integrityResult = getSQLIntegrityCheck(db);
    if (integrityResult) {
      console.log('Database integrity check failed:', integrityResult);
      throw new Error(`Integrity check failed: ${integrityResult}`);
    }

    // At this point we can allow general access to the database
    globalInstance = db;

    console.info('total message count before cleaning: ', getMessageCount());
    console.info('total conversation count before cleaning: ', getConversationCount());
    cleanUpOldOpengroupsOnStart();
    cleanUpUnusedNodeForKeyEntriesOnStart();
    printDbStats();

    console.info('total message count after cleaning: ', getMessageCount());
    console.info('total conversation count after cleaning: ', getConversationCount());

    // Clear any already deleted db entries on each app start.
    vacuumDatabase(db);
  } catch (error) {
    console.error('error', error);
    if (passwordAttempt) {
      throw error;
    }
    console.log('Database startup error:', error.stack);
    const button = await dialog.showMessageBox({
      buttons: [messages.copyErrorAndQuit, messages.clearAllData],
      defaultId: 0,
      detail: redactAll(error.stack),
      message: messages.databaseError,
      noLink: true,
      type: 'error',
    });

    if (button.response === 0) {
      clipboard.writeText(`Database startup error:\n\n${redactAll(error.stack)}`);
    } else {
      close();
      showFailedToStart();
    }

    app.exit(1);
    return false;
  }

  return true;
}

function close() {
  if (!globalInstance) {
    return;
  }
  const dbRef = globalInstance;
  globalInstance = null;
  // SQLLite documentation suggests that we run `PRAGMA optimize` right before
  // closing the database connection.
  dbRef.pragma('optimize');
  dbRef.close();
}

function removeDB(configDir = null) {
  if (globalInstance) {
    throw new Error('removeDB: Cannot erase database when it is open!');
  }

  if (!databaseFilePath && configDir) {
    _initializePaths(configDir);
  }

  if (databaseFilePath) {
    rimraf.sync(databaseFilePath);
    rimraf.sync(`${databaseFilePath}-shm`);
    rimraf.sync(`${databaseFilePath}-wal`);
  }
}

// Password hash
const PASS_HASH_ID = 'passHash';
function getPasswordHash() {
  const item = getItemById(PASS_HASH_ID);
  return item && item.value;
}
function savePasswordHash(hash: string) {
  if (isEmpty(hash)) {
    removePasswordHash();
    return;
  }

  const data = { id: PASS_HASH_ID, value: hash };
  createOrUpdateItem(data);
}
function removePasswordHash() {
  removeItemById(PASS_HASH_ID);
}

function getIdentityKeyById(id: string, instance: BetterSqlite3.Database) {
  return getById(IDENTITY_KEYS_TABLE, id, instance);
}

function getGuardNodes() {
  const nodes = assertGlobalInstance()
    .prepare(`SELECT ed25519PubKey FROM ${GUARD_NODE_TABLE};`)
    .all();

  if (!nodes) {
    return null;
  }

  return nodes;
}

function updateGuardNodes(nodes: Array<string>) {
  assertGlobalInstance().transaction(() => {
    assertGlobalInstance().exec(`DELETE FROM ${GUARD_NODE_TABLE}`);
    nodes.map(edkey =>
      assertGlobalInstance()
        .prepare(
          `INSERT INTO ${GUARD_NODE_TABLE} (
        ed25519PubKey
      ) values ($ed25519PubKey)`
        )
        .run({
          ed25519PubKey: edkey,
        })
    );
  })();
}

function createOrUpdateItem(data: StorageItem, instance?: BetterSqlite3.Database) {
  createOrUpdate(ITEMS_TABLE, data, instance);
}
function getItemById(id: string) {
  return getById(ITEMS_TABLE, id);
}
function getAllItems() {
  const rows = assertGlobalInstance()
    .prepare(`SELECT json FROM ${ITEMS_TABLE} ORDER BY id ASC;`)
    .all();
  return map(rows, row => jsonToObject(row.json));
}
function removeItemById(id: string) {
  removeById(ITEMS_TABLE, id);
  return;
}

function createOrUpdate(table: string, data: StorageItem, instance?: BetterSqlite3.Database) {
  const { id } = data;
  if (!id) {
    throw new Error('createOrUpdate: Provided data did not have a truthy id');
  }

  assertGlobalInstanceOrInstance(instance)
    .prepare(
      `INSERT OR REPLACE INTO ${table} (
      id,
      json
    ) values (
      $id,
      $json
    )`
    )
    .run({
      id,
      json: objectToJSON(data),
    });
}

function getById(table: string, id: string, instance?: BetterSqlite3.Database) {
  const row = assertGlobalInstanceOrInstance(instance)
    .prepare(`SELECT * FROM ${table} WHERE id = $id;`)
    .get({
      id,
    });

  if (!row) {
    return null;
  }

  return jsonToObject(row.json);
}

function removeById(table: string, id: string) {
  if (!Array.isArray(id)) {
    assertGlobalInstance()
      .prepare(`DELETE FROM ${table} WHERE id = $id;`)
      .run({ id });
    return;
  }

  if (!id.length) {
    throw new Error('removeById: No ids to delete!');
  }

  // Our node interface doesn't seem to allow you to replace one single ? with an array
  assertGlobalInstance()
    .prepare(`DELETE FROM ${table} WHERE id IN ( ${id.map(() => '?').join(', ')} );`)
    .run({ id });
}

// Conversations

function getSwarmNodesForPubkey(pubkey: string) {
  const row = assertGlobalInstance()
    .prepare(`SELECT * FROM ${NODES_FOR_PUBKEY_TABLE} WHERE pubkey = $pubkey;`)
    .get({
      pubkey,
    });

  if (!row) {
    return [];
  }

  return jsonToObject(row.json);
}

function updateSwarmNodesForPubkey(pubkey: string, snodeEdKeys: Array<string>) {
  assertGlobalInstance()
    .prepare(
      `INSERT OR REPLACE INTO ${NODES_FOR_PUBKEY_TABLE} (
        pubkey,
        json
        ) values (
          $pubkey,
          $json
          );`
    )
    .run({
      pubkey,
      json: objectToJSON(snodeEdKeys),
    });
}

function getConversationCount() {
  const row = assertGlobalInstance()
    .prepare(`SELECT count(*) from ${CONVERSATIONS_TABLE};`)
    .get();
  if (!row) {
    throw new Error(`getConversationCount: Unable to get count of ${CONVERSATIONS_TABLE}`);
  }

  return row['count(*)'];
}

// tslint:disable-next-line: max-func-body-length
// tslint:disable-next-line: cyclomatic-complexity
function saveConversation(data: ConversationAttributes, instance?: BetterSqlite3.Database) {
  const formatted = assertValidConversationAttributes(data);

  const {
    id,
    active_at,
    type,
    members,
    nickname,
    profileKey,
    zombies,
    left,
    expireTimer,
    mentionedUs,
    unreadCount,
    lastMessageStatus,
    lastMessage,
    lastJoinedTimestamp,
    groupAdmins,
    groupModerators,
    isKickedFromGroup,
    subscriberCount,
    readCapability,
    writeCapability,
    uploadCapability,
    is_medium_group,
    avatarPointer,
    avatarImageId,
    triggerNotificationsFor,
    isTrustedForAttachmentDownload,
    isPinned,
    isApproved,
    didApproveMe,
    avatarInProfile,
    displayNameInProfile,
    conversationIdOrigin,
  } = formatted;

  // shorten the last message as we never need more than 60 chars (and it bloats the redux/ipc calls uselessly

  const shortenedLastMessage =
    isString(lastMessage) && lastMessage.length > 60 ? lastMessage.substring(60) : lastMessage;
  assertGlobalInstanceOrInstance(instance)
    .prepare(
      `INSERT OR REPLACE INTO ${CONVERSATIONS_TABLE} (
	id,
	active_at,
	type,
	members,
  nickname,
  profileKey,
  zombies,
  left,
  expireTimer,
  mentionedUs,
  unreadCount,
  lastMessageStatus,
  lastMessage,
  lastJoinedTimestamp,
  groupAdmins,
  groupModerators,
  isKickedFromGroup,
  subscriberCount,
  readCapability,
  writeCapability,
  uploadCapability,
  is_medium_group,
  avatarPointer,
  avatarImageId,
  triggerNotificationsFor,
  isTrustedForAttachmentDownload,
  isPinned,
  isApproved,
  didApproveMe,
  avatarInProfile,
  displayNameInProfile,
  conversationIdOrigin
	) values (
	    $id,
	    $active_at,
	    $type,
	    $members,
      $nickname,
      $profileKey,
      $zombies,
      $left,
      $expireTimer,
      $mentionedUs,
      $unreadCount,
      $lastMessageStatus,
      $lastMessage,
      $lastJoinedTimestamp,
      $groupAdmins,
      $groupModerators,
      $isKickedFromGroup,
      $subscriberCount,
      $readCapability,
      $writeCapability,
      $uploadCapability,
      $is_medium_group,
      $avatarPointer,
      $avatarImageId,
      $triggerNotificationsFor,
      $isTrustedForAttachmentDownload,
      $isPinned,
      $isApproved,
      $didApproveMe,
      $avatarInProfile,
      $displayNameInProfile,
      $conversationIdOrigin
      )`
    )
    .run({
      id,
      active_at,
      type,
      members: members && members.length ? arrayStrToJson(members) : '[]',
      nickname,
      profileKey,
      zombies: zombies && zombies.length ? arrayStrToJson(zombies) : '[]',
      left: toSqliteBoolean(left),
      expireTimer,
      mentionedUs: toSqliteBoolean(mentionedUs),
      unreadCount,
      lastMessageStatus,
      lastMessage: shortenedLastMessage,

      lastJoinedTimestamp,
      groupAdmins: groupAdmins && groupAdmins.length ? arrayStrToJson(groupAdmins) : '[]',
      groupModerators:
        groupModerators && groupModerators.length ? arrayStrToJson(groupModerators) : '[]',
      isKickedFromGroup: toSqliteBoolean(isKickedFromGroup),
      subscriberCount,
      readCapability: toSqliteBoolean(readCapability),
      writeCapability: toSqliteBoolean(writeCapability),
      uploadCapability: toSqliteBoolean(uploadCapability),

      is_medium_group: toSqliteBoolean(is_medium_group),
      avatarPointer,
      avatarImageId,
      triggerNotificationsFor,
      isTrustedForAttachmentDownload: toSqliteBoolean(isTrustedForAttachmentDownload),
      isPinned: toSqliteBoolean(isPinned),
      isApproved: toSqliteBoolean(isApproved),
      didApproveMe: toSqliteBoolean(didApproveMe),
      avatarInProfile,
      displayNameInProfile,
      conversationIdOrigin,
    });
}

function removeConversation(id: string | Array<string>) {
  if (!Array.isArray(id)) {
    assertGlobalInstance()
      .prepare(`DELETE FROM ${CONVERSATIONS_TABLE} WHERE id = $id;`)
      .run({
        id,
      });
    return;
  }

  if (!id.length) {
    throw new Error('removeConversation: No ids to delete!');
  }

  // Our node interface doesn't seem to allow you to replace one single ? with an array
  assertGlobalInstance()
    .prepare(`DELETE FROM ${CONVERSATIONS_TABLE} WHERE id IN ( ${id.map(() => '?').join(', ')} );`)
    .run(id);
}

function getConversationById(id: string) {
  const row = assertGlobalInstance()
    .prepare(`SELECT * FROM ${CONVERSATIONS_TABLE} WHERE id = $id;`)
    .get({
      id,
    });

  return formatRowOfConversation(row);
}

function getAllConversations() {
  const rows = assertGlobalInstance()
    .prepare(`SELECT * FROM ${CONVERSATIONS_TABLE} ORDER BY id ASC;`)
    .all();
  return (rows || []).map(formatRowOfConversation);
}

function getAllOpenGroupV2Conversations(instance?: BetterSqlite3.Database) {
  // first _ matches all opengroupv1 (they are completely removed in a migration now),
  // second _ force a second char to be there, so it can only be opengroupv2 convos

  const rows = assertGlobalInstanceOrInstance(instance)
    .prepare(
      `SELECT * FROM ${CONVERSATIONS_TABLE} WHERE
      type = 'group' AND
      id LIKE 'publicChat:__%@%'
     ORDER BY id ASC;`
    )
    .all();

  return (rows || []).map(formatRowOfConversation);
}

function getAllOpenGroupV2ConversationsIds(): Array<string> {
  // first _ matches all opengroupv1 (they are completely removed in a migration now),
  // second _ force a second char to be there, so it can only be opengroupv2 convos

  const rows = assertGlobalInstance()
    .prepare(
      `SELECT id FROM ${CONVERSATIONS_TABLE} WHERE
      type = 'group' AND
      id LIKE 'publicChat:__%@%'
     ORDER BY id ASC;`
    )
    .all();

  return map(rows, row => row.id);
}

function getPubkeysInPublicConversation(conversationId: string) {
  const rows = assertGlobalInstance()
    .prepare(
      `SELECT DISTINCT source FROM ${MESSAGES_TABLE} WHERE
      conversationId = $conversationId
     ORDER BY received_at DESC LIMIT ${MAX_PUBKEYS_MEMBERS};`
    )
    .all({
      conversationId,
    });

  return map(rows, row => row.source);
}

function searchConversations(query: string) {
  const rows = assertGlobalInstance()
    .prepare(
      `SELECT * FROM ${CONVERSATIONS_TABLE} WHERE
      (
        displayNameInProfile LIKE $displayNameInProfile OR
        nickname LIKE $nickname
      ) AND active_at IS NOT NULL AND active_at > 0
     ORDER BY active_at DESC
     LIMIT $limit`
    )
    .all({
      displayNameInProfile: `%${query}%`,
      nickname: `%${query}%`,
      limit: 50,
    });

  return (rows || []).map(formatRowOfConversation);
}

// order by clause is the same as orderByClause but with a table prefix so we cannot reuse it
const orderByMessageCoalesceClause = `ORDER BY COALESCE(${MESSAGES_TABLE}.serverTimestamp, ${MESSAGES_TABLE}.sent_at, ${MESSAGES_TABLE}.received_at) DESC`;

function searchMessages(query: string, limit: number) {
  if (!limit) {
    throw new Error('searchMessages limit must be set');
  }

  const rows = assertGlobalInstance()
    .prepare(
      `SELECT
      ${MESSAGES_TABLE}.json,
      snippet(${MESSAGES_FTS_TABLE}, -1, '<<left>>', '<<right>>', '...', 5) as snippet
    FROM ${MESSAGES_FTS_TABLE}
    INNER JOIN ${MESSAGES_TABLE} on ${MESSAGES_FTS_TABLE}.id = ${MESSAGES_TABLE}.id
    WHERE
     ${MESSAGES_FTS_TABLE} match $query
    ${orderByMessageCoalesceClause}
    LIMIT $limit;`
    )
    .all({
      query,
      limit,
    });

  return map(rows, row => ({
    ...jsonToObject(row.json),
    snippet: row.snippet,
  }));
}

function searchMessagesInConversation(query: string, conversationId: string, limit: number) {
  const rows = assertGlobalInstance()
    .prepare(
      `SELECT
      ${MESSAGES_TABLE}.json,
      snippet(${MESSAGES_FTS_TABLE}, -1, '<<left>>', '<<right>>', '...', 15) as snippet
    FROM ${MESSAGES_FTS_TABLE}
    INNER JOIN ${MESSAGES_TABLE} on ${MESSAGES_FTS_TABLE}.id = ${MESSAGES_TABLE}.id
    WHERE
    ${MESSAGES_FTS_TABLE} match $query AND
      ${MESSAGES_TABLE}.conversationId = $conversationId
    ${orderByMessageCoalesceClause}
      LIMIT $limit;`
    )
    .all({
      query,
      conversationId,
      limit: limit || 100,
    });

  return map(rows, row => ({
    ...jsonToObject(row.json),
    snippet: row.snippet,
  }));
}

function getMessageCount() {
  const row = assertGlobalInstance()
    .prepare(`SELECT count(*) from ${MESSAGES_TABLE};`)
    .get();

  if (!row) {
    throw new Error(`getMessageCount: Unable to get count of ${MESSAGES_TABLE}`);
  }
  return row['count(*)'];
}

function saveMessage(data: any) {
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
    sent,
    // eslint-disable-next-line camelcase
    sent_at,
    source,
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
    id,
    json: objectToJSON(data),

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
    sent,
    sent_at,
    source,
    type: type || '',
    unread,
  };

  assertGlobalInstance()
    .prepare(
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
    sent,
    sent_at,
    source,
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
    $sent,
    $sent_at,
    $source,
    $type,
    $unread
  );`
    )
    .run(payload);

  return id;
}

function saveSeenMessageHashes(arrayOfHashes: Array<string>) {
  assertGlobalInstance().transaction(() => {
    map(arrayOfHashes, saveSeenMessageHash);
  })();
}

function updateLastHash(data: UpdateLastHashType) {
  const { convoId, snode, hash, expiresAt, namespace } = data;
  if (!isNumber(namespace)) {
    throw new Error('updateLastHash: namespace must be set to a number');
  }
  assertGlobalInstance()
    .prepare(
      `INSERT OR REPLACE INTO ${LAST_HASHES_TABLE} (
      id,
      snode,
      hash,
      expiresAt,
      namespace
    ) values (
      $id,
      $snode,
      $hash,
      $expiresAt,
      $namespace
    )`
    )
    .run({
      id: convoId,
      snode,
      hash,
      expiresAt,
      namespace,
    });
}

function saveSeenMessageHash(data: any) {
  const { expiresAt, hash } = data;
  try {
    assertGlobalInstance()
      .prepare(
        `INSERT INTO seenMessages (
      expiresAt,
      hash
      ) values (
        $expiresAt,
        $hash
        );`
      )
      .run({
        expiresAt,
        hash,
      });
  } catch (e) {
    console.error('saveSeenMessageHash failed:', e.message);
  }
}

function cleanLastHashes() {
  assertGlobalInstance()
    .prepare(`DELETE FROM ${LAST_HASHES_TABLE} WHERE expiresAt <= $now;`)
    .run({
      now: Date.now(),
    });
}

function cleanSeenMessages() {
  assertGlobalInstance()
    .prepare('DELETE FROM seenMessages WHERE expiresAt <= $now;')
    .run({
      now: Date.now(),
    });
}

function saveMessages(arrayOfMessages: Array<any>) {
  console.info('saveMessages of length: ', arrayOfMessages.length);
  assertGlobalInstance().transaction(() => {
    map(arrayOfMessages, saveMessage);
  })();
}

function removeMessage(id: string, instance?: BetterSqlite3.Database) {
  if (!Array.isArray(id)) {
    assertGlobalInstanceOrInstance(instance)
      .prepare(`DELETE FROM ${MESSAGES_TABLE} WHERE id = $id;`)
      .run({ id });
    return;
  }

  if (!id.length) {
    throw new Error('removeMessages: No ids to delete!');
  }

  // Our node interface doesn't seem to allow you to replace one single ? with an array
  assertGlobalInstanceOrInstance(instance)
    .prepare(`DELETE FROM ${MESSAGES_TABLE} WHERE id IN ( ${id.map(() => '?').join(', ')} );`)
    .run(id);
}

function getMessageIdsFromServerIds(serverIds: Array<string | number>, conversationId: string) {
  if (!Array.isArray(serverIds)) {
    return [];
  }

  // Sanitize the input as we're going to use it directly in the query
  const validServerIds = serverIds.map(Number).filter(n => !Number.isNaN(n));

  /*
    Sqlite3 doesn't have a good way to have `IN` query with another query.
    See: https://github.com/mapbox/node-sqlite3/issues/762.

    So we have to use templating to insert the values.
  */
  const rows = assertGlobalInstance()
    .prepare(
      `SELECT id FROM ${MESSAGES_TABLE} WHERE
    serverId IN (${validServerIds.join(',')}) AND
    conversationId = $conversationId;`
    )
    .all({
      conversationId,
    });
  return rows.map(row => row.id);
}

function getMessageById(id: string) {
  const row = assertGlobalInstance()
    .prepare(`SELECT * FROM ${MESSAGES_TABLE} WHERE id = $id;`)
    .get({
      id,
    });

  if (!row) {
    return null;
  }

  return jsonToObject(row.json);
}

function getMessageBySenderAndSentAt({ source, sentAt }: { source: string; sentAt: number }) {
  const rows = assertGlobalInstance()
    .prepare(
      `SELECT json FROM ${MESSAGES_TABLE} WHERE
      source = $source AND
      sent_at = $sent_at;`
    )
    .all({
      source,
      sent_at: sentAt,
    });

  return map(rows, row => jsonToObject(row.json));
}

function getMessagesCountBySender({ source }: { source: string }) {
  if (!source) {
    throw new Error('source must be set');
  }
  const count = assertGlobalInstance()
    .prepare(
      `SELECT count(*) FROM ${MESSAGES_TABLE} WHERE
      source = $source;`
    )
    .get({
      source,
    });
  if (!count) {
    return 0;
  }

  return count['count(*)'] || 0;
}

function getMessageBySenderAndTimestamp({
  source,
  timestamp,
}: {
  source: string;
  timestamp: number;
}) {
  const rows = assertGlobalInstance()
    .prepare(
      `SELECT json FROM ${MESSAGES_TABLE} WHERE
      source = $source AND
      sent_at = $timestamp;`
    )
    .all({
      source,
      timestamp,
    });

  return map(rows, row => jsonToObject(row.json));
}

function filterAlreadyFetchedOpengroupMessage(
  msgDetails: Array<{ sender: string; serverTimestamp: number }> // MsgDuplicateSearchOpenGroup
): Array<{ sender: string; serverTimestamp: number }> {
  const filteredNonBlinded = msgDetails.filter(msg => {
    const rows = assertGlobalInstance()
      .prepare(
        `SELECT source, serverTimestamp  FROM ${MESSAGES_TABLE} WHERE
      source = $sender AND
      serverTimestamp = $serverTimestamp;`
      )
      .all({
        sender: msg.sender,
        serverTimestamp: msg.serverTimestamp,
      });
    if (rows.length) {
      console.info(
        `filtering out already received sogs message from ${msg.sender} at ${msg.serverTimestamp} `
      );
      return false;
    }
    return true;
  });

  return filteredNonBlinded;
}

function getUnreadByConversation(conversationId: string) {
  const rows = assertGlobalInstance()
    .prepare(
      `SELECT * FROM ${MESSAGES_TABLE} WHERE
      unread = $unread AND
      conversationId = $conversationId
     ORDER BY received_at DESC;`
    )
    .all({
      unread: 1,
      conversationId,
    });

  return rows;
}

function getUnreadCountByConversation(conversationId: string) {
  const row = assertGlobalInstance()
    .prepare(
      `SELECT count(*) FROM ${MESSAGES_TABLE} WHERE
    unread = $unread AND
    conversationId = $conversationId;`
    )
    .get({
      unread: 1,
      conversationId,
    });

  if (!row) {
    throw new Error(
      `getUnreadCountByConversation: Unable to get unread count of ${conversationId}`
    );
  }

  return row['count(*)'];
}

function getMessageCountByType(conversationId: string, type = '%') {
  const row = assertGlobalInstance()
    .prepare(
      `SELECT count(*) from ${MESSAGES_TABLE}
      WHERE conversationId = $conversationId
      AND type = $type;`
    )
    .get({
      conversationId,
      type,
    });

  if (!row) {
    throw new Error(
      `getIncomingMessagesCountByConversation: Unable to get incoming messages count of ${conversationId}`
    );
  }

  return row['count(*)'];
}

// Note: Sorting here is necessary for getting the last message (with limit 1)
// be sure to update the sorting order to sort messages on redux too (sortMessages)
const orderByClause = 'ORDER BY COALESCE(serverTimestamp, sent_at, received_at) DESC';
const orderByClauseASC = 'ORDER BY COALESCE(serverTimestamp, sent_at, received_at) ASC';

function getMessagesByConversation(conversationId: string, { messageId = null } = {}) {
  const absLimit = 30;
  // If messageId is given it means we are opening the conversation to that specific messageId,
  // or that we just scrolled to it by a quote click and needs to load around it.
  // If messageId is null, it means we are just opening the convo to the last unread message, or at the bottom
  const firstUnread = getFirstUnreadMessageIdInConversation(conversationId);

  const numberOfMessagesInConvo = getMessagesCountByConversation(conversationId, globalInstance);
  const floorLoadAllMessagesInConvo = 70;

  if (messageId || firstUnread) {
    const messageFound = getMessageById(messageId || firstUnread);

    if (messageFound && messageFound.conversationId === conversationId) {
      // tslint:disable-next-line: no-shadowed-variable
      const rows = assertGlobalInstance()
        .prepare(
          `WITH cte AS (
            SELECT id, conversationId, json, row_number() OVER (${orderByClause}) as row_number
              FROM ${MESSAGES_TABLE} WHERE conversationId = $conversationId
          ), current AS (
          SELECT row_number
            FROM cte
          WHERE id = $messageId

        )
        SELECT cte.*
          FROM cte, current
            WHERE ABS(cte.row_number - current.row_number) <= $limit
          ORDER BY cte.row_number;
          `
        )
        .all({
          conversationId,
          messageId: messageId || firstUnread,
          limit:
            numberOfMessagesInConvo < floorLoadAllMessagesInConvo
              ? floorLoadAllMessagesInConvo
              : absLimit,
        });

      return map(rows, row => jsonToObject(row.json));
    }
    console.info(
      `getMessagesByConversation: Could not find messageId ${messageId} in db with conversationId: ${conversationId}. Just fetching the convo as usual.`
    );
  }

  const limit =
    numberOfMessagesInConvo < floorLoadAllMessagesInConvo
      ? floorLoadAllMessagesInConvo
      : absLimit * 2;

  const rows = assertGlobalInstance()
    .prepare(
      `
    SELECT json FROM ${MESSAGES_TABLE} WHERE
      conversationId = $conversationId
      ${orderByClause}
    LIMIT $limit;
    `
    )
    .all({
      conversationId,
      limit,
    });

  return map(rows, row => jsonToObject(row.json));
}

function getLastMessagesByConversation(conversationId: string, limit: number) {
  if (!isNumber(limit)) {
    throw new Error('limit must be a number');
  }

  const rows = assertGlobalInstance()
    .prepare(
      `
    SELECT json FROM ${MESSAGES_TABLE} WHERE
      conversationId = $conversationId
      ${orderByClause}
    LIMIT $limit;
    `
    )
    .all({
      conversationId,
      limit,
    });
  return map(rows, row => jsonToObject(row.json));
}

/**
 * This is the oldest message so we cannot reuse getLastMessagesByConversation
 */
function getOldestMessageInConversation(conversationId: string) {
  const rows = assertGlobalInstance()
    .prepare(
      `
    SELECT json FROM ${MESSAGES_TABLE} WHERE
      conversationId = $conversationId
      ${orderByClauseASC}
    LIMIT $limit;
    `
    )
    .all({
      conversationId,
      limit: 1,
    });
  return map(rows, row => jsonToObject(row.json));
}

function hasConversationOutgoingMessage(conversationId: string) {
  const row = assertGlobalInstance()
    .prepare(
      `
    SELECT count(*)  FROM ${MESSAGES_TABLE} WHERE
      conversationId = $conversationId AND
      type IS 'outgoing'
    `
    )
    .get({
      conversationId,
    });
  if (!row) {
    throw new Error('hasConversationOutgoingMessage: Unable to get coun');
  }

  return Boolean(row['count(*)']);
}

function getFirstUnreadMessageIdInConversation(conversationId: string) {
  const rows = assertGlobalInstance()
    .prepare(
      `
    SELECT id FROM ${MESSAGES_TABLE} WHERE
      conversationId = $conversationId AND
      unread = $unread
      ORDER BY serverTimestamp ASC, serverId ASC, sent_at ASC, received_at ASC
    LIMIT 1;
    `
    )
    .all({
      conversationId,
      unread: 1,
    });

  if (rows.length === 0) {
    return undefined;
  }
  return rows[0].id;
}

function getFirstUnreadMessageWithMention(
  conversationId: string,
  ourPkInThatRoom: string // this might be a blinded id for a sogs
): string | undefined {
  if (!ourPkInThatRoom || !ourPkInThatRoom.length) {
    throw new Error('getFirstUnreadMessageWithMention needs our pubkey but nothing was given');
  }
  const likeMatch = `%@${ourPkInThatRoom}%`;

  const rows = assertGlobalInstance()
    .prepare(
      `
    SELECT id, json FROM ${MESSAGES_TABLE} WHERE
      conversationId = $conversationId AND
      unread = $unread AND
      body LIKE $likeMatch
      ORDER BY serverTimestamp ASC, serverId ASC, sent_at ASC, received_at ASC
    LIMIT 1;
    `
    )
    .all({
      conversationId,
      unread: 1,
      likeMatch,
    });

  if (rows.length === 0) {
    return undefined;
  }
  return rows[0].id;
}

function getMessagesBySentAt(sentAt: number) {
  const rows = assertGlobalInstance()
    .prepare(
      `SELECT * FROM ${MESSAGES_TABLE}
     WHERE sent_at = $sent_at
     ORDER BY received_at DESC;`
    )
    .all({
      sent_at: sentAt,
    });

  return map(rows, row => jsonToObject(row.json));
}

function getLastHashBySnode(convoId: string, snode: string, namespace: number) {
  if (!isNumber(namespace)) {
    throw new Error('getLastHashBySnode: namespace must be set to a number');
  }
  const row = assertGlobalInstance()
    .prepare(
      `SELECT * FROM ${LAST_HASHES_TABLE} WHERE snode = $snode AND id = $id AND namespace = $namespace;`
    )
    .get({
      snode,
      id: convoId,
      namespace,
    });

  if (!row) {
    return null;
  }

  return row.hash;
}

function getSeenMessagesByHashList(hashes: Array<string>) {
  const rows = assertGlobalInstance()
    .prepare(`SELECT * FROM seenMessages WHERE hash IN ( ${hashes.map(() => '?').join(', ')} );`)
    .all(hashes);

  return map(rows, row => row.hash);
}

function getExpiredMessages() {
  const now = Date.now();

  const rows = assertGlobalInstance()
    .prepare(
      `SELECT json FROM ${MESSAGES_TABLE} WHERE
      expires_at IS NOT NULL AND
      expires_at <= $expires_at
     ORDER BY expires_at ASC;`
    )
    .all({
      expires_at: now,
    });

  return map(rows, row => jsonToObject(row.json));
}

function getOutgoingWithoutExpiresAt() {
  const rows = assertGlobalInstance()
    .prepare(
      `
    SELECT json FROM ${MESSAGES_TABLE}
    WHERE
      expireTimer > 0 AND
      expires_at IS NULL AND
      type IS 'outgoing'
    ORDER BY expires_at ASC;
  `
    )
    .all();

  return map(rows, row => jsonToObject(row.json));
}

function getNextExpiringMessage() {
  const rows = assertGlobalInstance()
    .prepare(
      `
    SELECT json FROM ${MESSAGES_TABLE}
    WHERE expires_at > 0
    ORDER BY expires_at ASC
    LIMIT 1;
  `
    )
    .all();

  return map(rows, row => jsonToObject(row.json));
}

/* Unproccessed a received messages not yet processed */
function saveUnprocessed(data: any) {
  const { id, timestamp, version, attempts, envelope, senderIdentity, messageHash } = data;
  if (!id) {
    throw new Error(`saveUnprocessed: id was falsey: ${id}`);
  }

  assertGlobalInstance()
    .prepare(
      `INSERT OR REPLACE INTO unprocessed (
      id,
      timestamp,
      version,
      attempts,
      envelope,
      senderIdentity,
      serverHash
    ) values (
      $id,
      $timestamp,
      $version,
      $attempts,
      $envelope,
      $senderIdentity,
      $messageHash
    );`
    )
    .run({
      id,
      timestamp,
      version,
      attempts,
      envelope,
      senderIdentity,
      messageHash,
    });

  return id;
}

function updateUnprocessedAttempts(id: string, attempts: number) {
  assertGlobalInstance()
    .prepare('UPDATE unprocessed SET attempts = $attempts WHERE id = $id;')
    .run({
      id,
      attempts,
    });
}
function updateUnprocessedWithData(id: string, data: any = {}) {
  const { source, serverTimestamp, decrypted, senderIdentity } = data;

  assertGlobalInstance()
    .prepare(
      `UPDATE unprocessed SET
      source = $source,
      serverTimestamp = $serverTimestamp,
      decrypted = $decrypted,
      senderIdentity = $senderIdentity
    WHERE id = $id;`
    )
    .run({
      id,
      source,
      serverTimestamp,
      decrypted,
      senderIdentity,
    });
}

function getUnprocessedById(id: string) {
  const row = assertGlobalInstance()
    .prepare('SELECT * FROM unprocessed WHERE id = $id;')
    .get({
      id,
    });

  return row;
}

function getUnprocessedCount() {
  const row = assertGlobalInstance()
    .prepare('SELECT count(*) from unprocessed;')
    .get();

  if (!row) {
    throw new Error('getMessageCount: Unable to get count of unprocessed');
  }

  return row['count(*)'];
}

function getAllUnprocessed() {
  const rows = assertGlobalInstance()
    .prepare('SELECT * FROM unprocessed ORDER BY timestamp ASC;')
    .all();

  return rows;
}

function removeUnprocessed(id: string) {
  if (!Array.isArray(id)) {
    assertGlobalInstance()
      .prepare('DELETE FROM unprocessed WHERE id = $id;')
      .run({ id });
    return;
  }

  if (!id.length) {
    throw new Error('removeUnprocessed: No ids to delete!');
  }

  // Our node interface doesn't seem to allow you to replace one single ? with an array
  assertGlobalInstance()
    .prepare(`DELETE FROM unprocessed WHERE id IN ( ${id.map(() => '?').join(', ')} );`)
    .run(id);
}

function removeAllUnprocessed() {
  assertGlobalInstance()
    .prepare('DELETE FROM unprocessed;')
    .run();
}

function getNextAttachmentDownloadJobs(limit: number) {
  const timestamp = Date.now();

  const rows = assertGlobalInstance()
    .prepare(
      `SELECT json FROM ${ATTACHMENT_DOWNLOADS_TABLE}
    WHERE pending = 0 AND timestamp < $timestamp
    ORDER BY timestamp DESC
    LIMIT $limit;`
    )
    .all({
      limit,
      timestamp,
    });

  return map(rows, row => jsonToObject(row.json));
}

function saveAttachmentDownloadJob(job: any) {
  const { id, pending, timestamp } = job;
  if (!id) {
    throw new Error('saveAttachmentDownloadJob: Provided job did not have a truthy id');
  }

  assertGlobalInstance()
    .prepare(
      `INSERT OR REPLACE INTO ${ATTACHMENT_DOWNLOADS_TABLE} (
      id,
      pending,
      timestamp,
      json
    ) values (
      $id,
      $pending,
      $timestamp,
      $json
    )`
    )
    .run({
      id,
      pending,
      timestamp,
      json: objectToJSON(job),
    });
}

function setAttachmentDownloadJobPending(id: string, pending: 1 | 0) {
  assertGlobalInstance()
    .prepare(`UPDATE ${ATTACHMENT_DOWNLOADS_TABLE} SET pending = $pending WHERE id = $id;`)
    .run({
      id,
      pending,
    });
}

function resetAttachmentDownloadPending() {
  assertGlobalInstance()
    .prepare(`UPDATE ${ATTACHMENT_DOWNLOADS_TABLE} SET pending = 0 WHERE pending != 0;`)
    .run();
}
function removeAttachmentDownloadJob(id: string) {
  removeById(ATTACHMENT_DOWNLOADS_TABLE, id);
}
function removeAllAttachmentDownloadJobs() {
  assertGlobalInstance().exec(`DELETE FROM ${ATTACHMENT_DOWNLOADS_TABLE};`);
}

// All data in database
function removeAll() {
  assertGlobalInstance().exec(`
    DELETE FROM ${IDENTITY_KEYS_TABLE};
    DELETE FROM ${ITEMS_TABLE};
    DELETE FROM unprocessed;
    DELETE FROM ${LAST_HASHES_TABLE};
    DELETE FROM ${NODES_FOR_PUBKEY_TABLE};
    DELETE FROM ${CLOSED_GROUP_V2_KEY_PAIRS_TABLE};
    DELETE FROM seenMessages;
    DELETE FROM ${CONVERSATIONS_TABLE};
    DELETE FROM ${MESSAGES_TABLE};
    DELETE FROM ${ATTACHMENT_DOWNLOADS_TABLE};
    DELETE FROM ${MESSAGES_FTS_TABLE};
`);
}

function removeAllConversations() {
  assertGlobalInstance()
    .prepare(`DELETE FROM ${CONVERSATIONS_TABLE};`)
    .run();
}

function getMessagesWithVisualMediaAttachments(conversationId: string, limit?: number) {
  const rows = assertGlobalInstance()
    .prepare(
      `SELECT json FROM ${MESSAGES_TABLE} WHERE
      conversationId = $conversationId AND
      hasVisualMediaAttachments = 1
     ORDER BY received_at DESC
     LIMIT $limit;`
    )
    .all({
      conversationId,
      limit,
    });

  return map(rows, row => jsonToObject(row.json));
}

function getMessagesWithFileAttachments(conversationId: string, limit: number) {
  const rows = assertGlobalInstance()
    .prepare(
      `SELECT json FROM ${MESSAGES_TABLE} WHERE
      conversationId = $conversationId AND
      hasFileAttachments = 1
     ORDER BY received_at DESC
     LIMIT $limit;`
    )
    .all({
      conversationId,
      limit,
    });

  return map(rows, row => jsonToObject(row.json));
}

function getExternalFilesForMessage(message: any) {
  const { attachments, quote, preview } = message;
  const files: Array<any> = [];

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

function getExternalFilesForConversation(
  conversationAvatar:
    | string
    | {
        path?: string | undefined;
      }
    | undefined
) {
  const files = [];

  if (isString(conversationAvatar)) {
    files.push(conversationAvatar);
  }

  if (isObject(conversationAvatar)) {
    const avatarObj = conversationAvatar as Record<string, any>;
    if (isString(avatarObj.path)) {
      files.push(avatarObj.path);
    }
  }

  return files;
}

function removeKnownAttachments(allAttachments: Array<string>) {
  const lookup = fromPairs(map(allAttachments, file => [file, true]));
  const chunkSize = 50;

  const total = getMessageCount();
  console.log(`removeKnownAttachments: About to iterate through ${total} messages`);

  let count = 0;
  let complete = false;
  let id = '';

  while (!complete) {
    const rows = assertGlobalInstance()
      .prepare(
        `SELECT json FROM ${MESSAGES_TABLE}
       WHERE id > $id
       ORDER BY id ASC
       LIMIT $chunkSize;`
      )
      .all({
        id,
        chunkSize,
      });

    const messages = map(rows, row => jsonToObject(row.json));
    forEach(messages, message => {
      const externalFiles = getExternalFilesForMessage(message);
      forEach(externalFiles, file => {
        // tslint:disable-next-line: no-dynamic-delete
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

  console.log(`removeKnownAttachments: Done processing ${count} ${MESSAGES_TABLE}`);

  complete = false;
  count = 0;
  // Though conversations.id is a string, this ensures that, when coerced, this
  //   value is still a string but it's smaller than every other string.
  (id as any) = 0;

  const conversationTotal = getConversationCount();
  console.log(
    `removeKnownAttachments: About to iterate through ${conversationTotal} ${CONVERSATIONS_TABLE}`
  );

  while (!complete) {
    const conversations = assertGlobalInstance()
      .prepare(
        `SELECT * FROM ${CONVERSATIONS_TABLE}
       WHERE id > $id
       ORDER BY id ASC
       LIMIT $chunkSize;`
      )
      .all({
        id,
        chunkSize,
      });

    forEach(conversations, conversation => {
      const avatar = (conversation as ConversationAttributes)?.avatarInProfile;
      const externalFiles = getExternalFilesForConversation(avatar);
      forEach(externalFiles, file => {
        // tslint:disable-next-line: no-dynamic-delete
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

  console.log(`removeKnownAttachments: Done processing ${count} ${CONVERSATIONS_TABLE}`);

  return Object.keys(lookup);
}

function getMessagesCountByConversation(
  conversationId: string,
  instance?: BetterSqlite3.Database | null
): number {
  const row = assertGlobalInstanceOrInstance(instance)
    .prepare(`SELECT count(*) from ${MESSAGES_TABLE} WHERE conversationId = $conversationId;`)
    .get({ conversationId });

  return row ? row['count(*)'] : 0;
}

/**
 * The returned array is ordered based on the timestamp, the latest is at the end.
 * @param groupPublicKey string | PubKey
 */
function getAllEncryptionKeyPairsForGroup(groupPublicKey: string | PubKey) {
  const rows = getAllEncryptionKeyPairsForGroupRaw(groupPublicKey);

  return map(rows, row => jsonToObject(row.json));
}

function getAllEncryptionKeyPairsForGroupRaw(groupPublicKey: string | PubKey) {
  const pubkeyAsString = (groupPublicKey as PubKey).key
    ? (groupPublicKey as PubKey).key
    : groupPublicKey;
  const rows = assertGlobalInstance()
    .prepare(
      `SELECT * FROM ${CLOSED_GROUP_V2_KEY_PAIRS_TABLE} WHERE groupPublicKey = $groupPublicKey ORDER BY timestamp ASC;`
    )
    .all({
      groupPublicKey: pubkeyAsString,
    });

  return rows;
}

function getLatestClosedGroupEncryptionKeyPair(groupPublicKey: string) {
  const rows = getAllEncryptionKeyPairsForGroup(groupPublicKey);
  if (!rows || rows.length === 0) {
    return undefined;
  }
  return rows[rows.length - 1];
}

function addClosedGroupEncryptionKeyPair(
  groupPublicKey: string,
  keypair: object,
  instance?: BetterSqlite3.Database
) {
  const timestamp = Date.now();

  assertGlobalInstanceOrInstance(instance)
    .prepare(
      `INSERT OR REPLACE INTO ${CLOSED_GROUP_V2_KEY_PAIRS_TABLE} (
      groupPublicKey,
      timestamp,
        json
        ) values (
          $groupPublicKey,
          $timestamp,
          $json
          );`
    )
    .run({
      groupPublicKey,
      timestamp,
      json: objectToJSON(keypair),
    });
}

function removeAllClosedGroupEncryptionKeyPairs(groupPublicKey: string) {
  assertGlobalInstance()
    .prepare(
      `DELETE FROM ${CLOSED_GROUP_V2_KEY_PAIRS_TABLE} WHERE groupPublicKey = $groupPublicKey`
    )
    .run({
      groupPublicKey,
    });
}

/**
 * Related to Opengroup V2
 */
function getAllV2OpenGroupRooms(instance?: BetterSqlite3.Database): Array<OpenGroupV2Room> {
  const rows = assertGlobalInstanceOrInstance(instance)
    .prepare(`SELECT json FROM ${OPEN_GROUP_ROOMS_V2_TABLE};`)
    .all();

  if (!rows) {
    return [];
  }

  return rows.map(r => jsonToObject(r.json)) as Array<OpenGroupV2Room>;
}

function getV2OpenGroupRoom(conversationId: string) {
  const row = assertGlobalInstance()
    .prepare(
      `SELECT json FROM ${OPEN_GROUP_ROOMS_V2_TABLE} WHERE conversationId = $conversationId;`
    )
    .get({
      conversationId,
    });

  if (!row) {
    return null;
  }

  return jsonToObject(row.json);
}

function saveV2OpenGroupRoom(opengroupsv2Room: OpenGroupV2Room, instance?: BetterSqlite3.Database) {
  const { serverUrl, roomId, conversationId } = opengroupsv2Room;
  assertGlobalInstanceOrInstance(instance)
    .prepare(
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
    )`
    )
    .run({
      serverUrl,
      roomId,
      conversationId,
      json: objectToJSON(opengroupsv2Room),
    });
}

function removeV2OpenGroupRoom(conversationId: string) {
  assertGlobalInstance()
    .prepare(`DELETE FROM ${OPEN_GROUP_ROOMS_V2_TABLE} WHERE conversationId = $conversationId`)
    .run({
      conversationId,
    });
}

function getEntriesCountInTable(tbl: string) {
  try {
    const row = assertGlobalInstance()
      .prepare(`SELECT count(*) from ${tbl};`)
      .get();
    return row['count(*)'];
  } catch (e) {
    console.error(e);
    return 0;
  }
}

function printDbStats() {
  [
    'attachment_downloads',
    'conversations',
    'encryptionKeyPairsForClosedGroupV2',
    'guardNodes',
    'identityKeys',
    'items',
    'lastHashes',
    'loki_schema',
    'messages',
    'messages_fts',
    'messages_fts_config',
    'messages_fts_content',
    'messages_fts_data',
    'messages_fts_docsize',
    'messages_fts_idx',
    'nodesForPubkey',
    'openGroupRoomsV2',
    'seenMessages',
    'sqlite_sequence',
    'sqlite_stat1',
    'sqlite_stat4',
    'unprocessed',
  ].forEach(i => {
    console.log(`${i} count`, getEntriesCountInTable(i));
  });
}

/**
 * Remove all the unused entries in the snodes for pubkey table.
 * This table is used to know which snodes we should contact to send a message to a recipient
 */
function cleanUpUnusedNodeForKeyEntriesOnStart() {
  // we have to keep private and closed group ids
  const allIdsToKeep =
    assertGlobalInstance()
      .prepare(
        `SELECT id FROM ${CONVERSATIONS_TABLE} WHERE id NOT LIKE 'publicChat:%'
    `
      )
      .all()
      .map(m => m.id) || [];

  const allEntriesInSnodeForPubkey =
    assertGlobalInstance()
      .prepare(`SELECT pubkey FROM ${NODES_FOR_PUBKEY_TABLE};`)
      .all()
      .map(m => m.pubkey) || [];

  const swarmUnused = difference(allEntriesInSnodeForPubkey, allIdsToKeep);

  if (swarmUnused.length) {
    const start = Date.now();

    const chunks = chunk(swarmUnused, 500);
    chunks.forEach(ch => {
      assertGlobalInstance()
        .prepare(
          `DELETE FROM ${NODES_FOR_PUBKEY_TABLE} WHERE pubkey IN (${ch.map(() => '?').join(',')});`
        )
        .run(ch);
    });

    console.log(`Removing of ${swarmUnused.length} unused swarms took ${Date.now() - start}ms`);
  }
}

function cleanUpMessagesJson() {
  console.info('cleanUpMessagesJson ');
  const start = Date.now();
  assertGlobalInstance().transaction(() => {
    assertGlobalInstance().exec(`
      UPDATE ${MESSAGES_TABLE} SET
      json = json_remove(json, '$.schemaVersion', '$.recipients', '$.decrypted_at', '$.sourceDevice')
    `);
  })();

  console.info(`cleanUpMessagesJson took ${Date.now() - start}ms`);
}

function cleanUpOldOpengroupsOnStart() {
  const ourNumber = getItemById('number_id');
  if (!ourNumber || !ourNumber.value) {
    console.info('cleanUpOldOpengroups: ourNumber is not set');
    return;
  }
  const pruneSetting = getItemById('prune-setting')?.value;

  if (pruneSetting === undefined) {
    console.info(
      'Prune settings is undefined, skipping cleanUpOldOpengroups but we will need to ask user'
    );
    return;
  }

  if (!pruneSetting) {
    console.info('Prune setting not enabled, skipping cleanUpOldOpengroups');
    return;
  }

  const v2ConvosIds = getAllOpenGroupV2ConversationsIds();
  if (!v2ConvosIds || !v2ConvosIds.length) {
    console.info('cleanUpOldOpengroups: v2Convos is empty');
    return;
  }
  console.info(`Count of v2 opengroup convos to clean: ${v2ConvosIds.length}`);

  // For each opengroups, if it has more than 1000 messages, we remove all the messages older than 2 months.
  // So this does not limit the size of opengroup history to 1000 messages but to 2 months.
  // This is the only way we can cleanup conversations objects from users which just sent messages a while ago and with whom we never interacted.
  // This is only for opengroups, and is because ALL the conversations are cached in the redux store. Having a very large number of conversations (unused) is deteriorating a lot the performance of the app.
  // Another fix would be to not cache all the conversations in the redux store, but it ain't going to happen anytime soon as it would a pretty big change of the way we do things and would break a lot of the app.
  const maxMessagePerOpengroupConvo = 2000;

  // first remove very old messages for each opengroups
  const db = assertGlobalInstance();
  db.transaction(() => {
    dropFtsAndTriggers(db);
    v2ConvosIds.forEach(convoId => {
      const messagesInConvoBefore = getMessagesCountByConversation(convoId);

      if (messagesInConvoBefore >= maxMessagePerOpengroupConvo) {
        const minute = 1000 * 60;
        const sixMonths = minute * 60 * 24 * 30 * 6;
        const limitTimestamp = Date.now() - sixMonths;
        const countToRemove = assertGlobalInstance()
          .prepare(
            `SELECT count(*) from ${MESSAGES_TABLE} WHERE serverTimestamp <= $serverTimestamp AND conversationId = $conversationId;`
          )
          .get({ conversationId: convoId, serverTimestamp: limitTimestamp })['count(*)'];
        const start = Date.now();

        assertGlobalInstance()
          .prepare(
            `
        DELETE FROM ${MESSAGES_TABLE} WHERE serverTimestamp <= $serverTimestamp AND conversationId = $conversationId`
          )
          .run({ conversationId: convoId, serverTimestamp: limitTimestamp }); // delete messages older than 6 months ago.
        const messagesInConvoAfter = getMessagesCountByConversation(convoId);

        console.info(
          `Cleaning ${countToRemove} messages older than 6 months in public convo: ${convoId} took ${Date.now() -
            start}ms. Old message count: ${messagesInConvoBefore}, new message count: ${messagesInConvoAfter}`
        );

        const unreadCount = getUnreadCountByConversation(convoId);
        const convoProps = getConversationById(convoId);
        if (convoProps) {
          convoProps.unreadCount = unreadCount;
          saveConversation(convoProps);
        }
      } else {
        console.info(
          `Not cleaning messages older than 6 months in public convo: ${convoId}. message count: ${messagesInConvoBefore}`
        );
      }
    });

    // now, we might have a bunch of private conversation, without any interaction and no messages
    // those are the conversation of the old members in the opengroups we just cleaned.
    const allInactiveConvos = assertGlobalInstance()
      .prepare(
        `
    SELECT id FROM ${CONVERSATIONS_TABLE} WHERE type = 'private' AND (active_at IS NULL OR active_at = 0)`
      )
      .all();

    const ourPubkey = ourNumber.value.split('.')[0];

    const allInactiveAndWithoutMessagesConvo = allInactiveConvos
      .map(c => c.id as string)
      .filter(convoId => {
        return convoId !== ourPubkey && getMessagesCountBySender({ source: convoId }) === 0
          ? true
          : false;
      });
    if (allInactiveAndWithoutMessagesConvo.length) {
      console.info(
        `Removing ${allInactiveAndWithoutMessagesConvo.length} completely inactive convos`
      );
      const start = Date.now();

      const chunks = chunk(allInactiveAndWithoutMessagesConvo, 500);
      chunks.forEach(ch => {
        db.prepare(
          `DELETE FROM ${CONVERSATIONS_TABLE} WHERE id IN (${ch.map(() => '?').join(',')});`
        ).run(ch);
      });

      console.info(
        `Removing of ${
          allInactiveAndWithoutMessagesConvo.length
        } completely inactive convos done in ${Date.now() - start}ms`
      );
    }

    cleanUpMessagesJson();

    rebuildFtsTable(db);
  })();
}

// tslint:disable: binary-expression-operand-order insecure-random
/**
 * Only using this for development. Populate conversation and message tables.
 */
function fillWithTestData(numConvosToAdd: number, numMsgsToAdd: number) {
  const convoBeforeCount = assertGlobalInstance()
    .prepare(`SELECT count(*) from ${CONVERSATIONS_TABLE};`)
    .get()['count(*)'];

  const lipsum =
    // eslint:disable-next-line max-line-length
    `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis ac ornare lorem,
    non suscipit      purus. Lorem ipsum dolor sit amet, consectetur adipiscing elit.
    Suspendisse cursus aliquet       velit a dignissim. Integer at nisi sed velit consequat
    dictum. Phasellus congue tellus ante.        Ut rutrum hendrerit dapibus. Fusce
    luctus, ante nec interdum molestie, purus urna volutpat         turpis, eget mattis
    lectus velit at velit. Praesent vel tellus turpis. Praesent eget purus          at
    nisl blandit pharetra.  Cras dapibus sem vitae rutrum dapibus. Vivamus vitae mi
    ante.           Donec aliquam porta nibh, vel scelerisque orci condimentum sed.
    Proin in mattis ipsum,            ac euismod sem. Donec malesuada sem nisl, at
    vehicula ante efficitur sed. Curabitur             in sapien eros. Morbi tempor ante ut
    metus scelerisque condimentum. Integer sit amet              tempus nulla. Vivamus
    imperdiet dui ac luctus vulputate.  Sed a accumsan risus. Nulla               facilisi.
    Nulla mauris dui, luctus in sagittis at, sodales id mauris. Integer efficitur
            viverra ex, ut dignissim eros tincidunt placerat. Sed facilisis gravida
    mauris in luctus                . Fusce dapibus, est vitae tincidunt eleifend, justo
    odio porta dui, sed ultrices mi arcu                 vitae ante. Mauris ut libero
    erat. Nam ut mi quis ante tincidunt facilisis sit amet id enim.
    Vestibulum in molestie mi. In ac felis est. Vestibulum vel blandit ex. Morbi vitae
    viverra augue                  . Ut turpis quam, cursus quis ex a, convallis
    ullamcorper purus.  Nam eget libero arcu. Integer fermentum enim nunc, non consequat urna
    fermentum condimentum. Nulla vitae malesuada est. Donec imperdiet tortor interdum
    malesuada feugiat. Integer pulvinar dui ex, eget tristique arcu mattis at. Nam eu neque
    eget mauris varius suscipit. Quisque ac enim vitae mauris laoreet congue nec sed
    justo. Curabitur fermentum quam eget est tincidunt, at faucibus lacus maximus.  Donec
    auctor enim dolor, faucibus egestas diam consectetur sed. Donec eget rutrum arcu, at
    tempus mi. Fusce quis volutpat sapien. In aliquet fringilla purus. Ut eu nunc non
    augue lacinia ultrices at eget tortor. Maecenas pulvinar odio sit amet purus
    elementum, a vehicula lorem maximus. Pellentesque eu lorem magna. Vestibulum ut facilisis
    lorem. Proin et enim cursus, vulputate neque sit amet, posuere enim. Praesent
    faucibus tellus vel mi tincidunt, nec malesuada nibh malesuada. In laoreet sapien vitae
    aliquet sollicitudin.
    `;

  const msgBeforeCount = assertGlobalInstance()
    .prepare(`SELECT count(*) from ${MESSAGES_TABLE};`)
    .get()['count(*)'];

  console.info('==== fillWithTestData ====');
  console.info({
    convoBeforeCount,
    msgBeforeCount,
    convoToAdd: numConvosToAdd,
    msgToAdd: numMsgsToAdd,
  });

  const convosIdsAdded = [];
  // eslint-disable-next-line no-plusplus
  for (let index = 0; index < numConvosToAdd; index++) {
    const activeAt = Date.now() - index;
    const id = Date.now() - 1000 * index;
    const convoObjToAdd: ConversationAttributes = {
      active_at: activeAt,
      members: [],
      displayNameInProfile: `${activeAt}`,
      id: `05${id}`,
      type: 'group',
      didApproveMe: false,
      expireTimer: 0,
      groupAdmins: [],
      groupModerators: [],
      isApproved: false,
      isKickedFromGroup: false,
      isPinned: false,
      isTrustedForAttachmentDownload: false,
      is_medium_group: false,
      lastJoinedTimestamp: 0,
      lastMessage: null,
      lastMessageStatus: undefined,
      left: false,
      mentionedUs: false,
      subscriberCount: 0,
      readCapability: true,
      writeCapability: true,
      uploadCapability: true,
      triggerNotificationsFor: 'all',
      unreadCount: 0,
      zombies: [],
    };
    convosIdsAdded.push(id);
    try {
      saveConversation(convoObjToAdd);
      // eslint-disable-next-line no-empty
    } catch (e) {
      console.error(e);
    }
  }
  // eslint-disable-next-line no-plusplus
  for (let index = 0; index < numMsgsToAdd; index++) {
    const activeAt = Date.now() - index;
    const id = Date.now() - 1000 * index;

    const lipsumStartIdx = Math.floor(Math.random() * lipsum.length);
    const lipsumLength = Math.floor(Math.random() * lipsum.length - lipsumStartIdx);
    const fakeBodyText = lipsum.substring(lipsumStartIdx, lipsumStartIdx + lipsumLength);

    const convoId = convosIdsAdded[Math.floor(Math.random() * convosIdsAdded.length)];
    const msgObjToAdd = {
      // body: `fake body ${activeAt}`,
      body: `fakeMsgIdx-spongebob-${index} ${fakeBodyText} ${activeAt}`,
      conversationId: `05${id}`,
      // eslint-disable-next-line camelcase
      expires_at: 0,
      hasAttachments: 0,
      hasFileAttachments: 0,
      hasVisualMediaAttachments: 0,
      id: `${id}`,
      serverId: 0,
      serverTimestamp: 0,
      // eslint-disable-next-line camelcase
      received_at: Date.now(),
      sent: 0,
      // eslint-disable-next-line camelcase
      sent_at: Date.now(),
      source: `${convoId}`,
      type: 'outgoing',
      unread: 1,
      expireTimer: 0,
      expirationStartTimestamp: 0,
    };

    if (convoId % 10 === 0) {
      console.info('uyo , convoId ', { index, convoId });
    }

    try {
      saveMessage(msgObjToAdd);
      // eslint-disable-next-line no-empty
    } catch (e) {
      console.error(e);
    }
  }

  const convoAfterCount = assertGlobalInstance()
    .prepare(`SELECT count(*) from ${CONVERSATIONS_TABLE};`)
    .get()['count(*)'];

  const msgAfterCount = assertGlobalInstance()
    .prepare(`SELECT count(*) from ${MESSAGES_TABLE};`)
    .get()['count(*)'];

  console.info({ convoAfterCount, msgAfterCount });
  return convosIdsAdded;
}

export type SqlNodeType = typeof sqlNode;

export const sqlNode = {
  initializeSql,
  close,
  removeDB,
  setSQLPassword,

  getPasswordHash,
  savePasswordHash,
  removePasswordHash,

  getIdentityKeyById,

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
  removeConversation,
  getAllConversations,
  getAllOpenGroupV2Conversations,
  getPubkeysInPublicConversation,
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
  getMessageCountByType,

  getMessageBySenderAndSentAt,
  filterAlreadyFetchedOpengroupMessage,
  getMessageBySenderAndTimestamp,
  getMessageIdsFromServerIds,
  getMessageById,
  getMessagesBySentAt,
  getSeenMessagesByHashList,
  getLastHashBySnode,
  getExpiredMessages,
  getOutgoingWithoutExpiresAt,
  getNextExpiringMessage,
  getMessagesByConversation,
  getLastMessagesByConversation,
  getOldestMessageInConversation,
  getFirstUnreadMessageIdInConversation,
  getFirstUnreadMessageWithMention,
  hasConversationOutgoingMessage,
  fillWithTestData,

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
  removeKnownAttachments,

  removeAll,

  getMessagesWithVisualMediaAttachments,
  getMessagesWithFileAttachments,
  getMessagesCountByConversation,

  getAllEncryptionKeyPairsForGroup,
  getLatestClosedGroupEncryptionKeyPair,
  addClosedGroupEncryptionKeyPair,
  removeAllClosedGroupEncryptionKeyPairs,

  // open group v2
  getV2OpenGroupRoom,
  saveV2OpenGroupRoom,
  getAllV2OpenGroupRooms,
  removeV2OpenGroupRoom,
};

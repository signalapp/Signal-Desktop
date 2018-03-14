const idb = require('idb');
const Message = require('../../types/message');


exports.run = async (transaction) => {
  const db = idb.upgradeDBFromTransaction(transaction);
  const tx = db.transaction;
  const messagesStore = tx.objectStore('messages');

  console.log('Initialize messages schema version');
  await exports._initializeMessageSchemaVersion(messagesStore);

  console.log('Create index from attachment schema version to attachment');
  messagesStore.createIndex('schemaVersion', 'schemaVersion', { unique: false });

  await db.transaction.complete;
};

// NOTE: We disable `no-await-in-loop` because we want this migration to happen
// in sequence and not in parallel:
// https://eslint.org/docs/rules/no-await-in-loop#when-not-to-use-it
exports._initializeMessageSchemaVersion = async (messagesStore) => {
  let cursor = await messagesStore.openCursor();
  while (cursor) {
    const message = cursor.value;
    console.log('Initialize schema version for message:', message.id);

    const messageWithSchemaVersion = Message.initializeSchemaVersion(message);
    try {
      // eslint-disable-next-line no-await-in-loop
      await messagesStore.put(messageWithSchemaVersion, message.id);
    } catch (error) {
      console.log('Failed to put message with initialized schema version:', message.id);
    }

    // eslint-disable-next-line no-await-in-loop
    cursor = await cursor.continue();
  }
};

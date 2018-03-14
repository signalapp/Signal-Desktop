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

exports._initializeMessageSchemaVersion = messagesStore =>
  new Promise((resolve, reject) => {
    messagesStore.openCursor().then(async function cursorIterate(cursor) {
      const hasMoreResults = Boolean(cursor);
      if (!hasMoreResults) {
        return resolve();
      }

      const message = cursor.value;
      console.log('Initialize schema version for message:', message.id);

      const messageWithInitializedSchemaVersion = Message.initializeSchemaVersion(message);
      try {
        await messagesStore.put(messageWithInitializedSchemaVersion, message.id);
      } catch (error) {
        console.log('Failed to put message with initialized schema version:', message.id);
      }

      cursor.continue().then(cursorIterate);
    }).catch(reject);
  });

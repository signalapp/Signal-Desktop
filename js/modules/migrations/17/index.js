const Message = require('../../types/message');


exports.run = async (transaction) => {
  const messagesStore = transaction.objectStore('messages');

  console.log('Initialize messages schema version');
  const numUpgradedMessages = await _initializeMessageSchemaVersion(messagesStore);
  console.log('Complete messages schema version initialization', { numUpgradedMessages });

  console.log('Create index from attachment schema version to attachment');
  messagesStore.createIndex('schemaVersion', 'schemaVersion', { unique: false });
};

const _initializeMessageSchemaVersion = messagesStore =>
  new Promise((resolve, reject) => {
    const messagePutOperations = [];

    const cursorRequest = messagesStore.openCursor();
    cursorRequest.onsuccess = async (event) => {
      const cursor = event.target.result;
      const hasMoreData = Boolean(cursor);
      if (!hasMoreData) {
        await Promise.all(messagePutOperations);
        return resolve(messagePutOperations.length);
      }

      const message = cursor.value;
      const messageWithSchemaVersion = Message.initializeSchemaVersion(message);
      messagePutOperations.push(putItem(
        messagesStore,
        messageWithSchemaVersion,
        messageWithSchemaVersion.id
      ));

      return cursor.continue();
    };

    cursorRequest.onerror = event =>
      reject(event.target.error);
  });

//    putItem :: IDBObjectStore -> Item -> Key -> Promise Item
const putItem = (store, item, key) =>
  new Promise((resolve, reject) => {
    try {
      const request = store.put(item, key);
      request.onsuccess = event =>
        resolve(event.target.result);
      request.onerror = event =>
        reject(event.target.error);
    } catch (error) {
      reject(error);
    }
  });

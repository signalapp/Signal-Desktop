/* global window */

const { deferredToPromise } = require('./deferred_to_promise');
const MessageType = require('./types/message');

// calls to search for:
//   .fetch(
//   .save(
//   .destroy(

async function saveMessage(data, { Message }) {
  const message = new Message(data);
  await deferredToPromise(message.save());
  return message.id;
}

async function removeMessage(id, { Message }) {
  const message = await getMessageById(id, { Message });
  // Note: It's important to have a fully database-hydrated model to delete here because
  //   it needs to delete all associated on-disk files along with the database delete.
  if (message) {
    await deferredToPromise(message.destroy());
  }
}

async function getMessageById(id, { Message }) {
  const message = new Message({ id });
  try {
    await deferredToPromise(message.fetch());
    return message;
  } catch (error) {
    return null;
  }
}

async function getAllMessageIds({ db, handleDOMException, getMessageKey }) {
  const lookup = Object.create(null);
  const storeName = 'messages';

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.onerror = () => {
      handleDOMException(
        `assembleLookup(${storeName}) transaction error`,
        transaction.error,
        reject
      );
    };
    transaction.oncomplete = () => {
      // not really very useful - fires at unexpected times
    };

    const store = transaction.objectStore(storeName);
    const request = store.openCursor();
    request.onerror = () => {
      handleDOMException(
        `assembleLookup(${storeName}) request error`,
        request.error,
        reject
      );
    };
    request.onsuccess = event => {
      const cursor = event.target.result;
      if (cursor && cursor.value) {
        lookup[getMessageKey(cursor.value)] = true;
        cursor.continue();
      } else {
        window.log.info(`Done creating ${storeName} lookup`);
        resolve(lookup);
      }
    };
  });
}

async function getMessageBySender(
  // eslint-disable-next-line camelcase
  { source, sourceDevice, sent_at },
  { Message }
) {
  const fetcher = new Message();
  const options = {
    index: {
      name: 'unique',
      // eslint-disable-next-line camelcase
      value: [source, sourceDevice, sent_at],
    },
  };

  try {
    await deferredToPromise(fetcher.fetch(options));
    if (fetcher.get('id')) {
      return fetcher;
    }

    return null;
  } catch (error) {
    return null;
  }
}

async function getUnreadByConversation(conversationId, { MessageCollection }) {
  const messages = new MessageCollection();

  await deferredToPromise(
    messages.fetch({
      index: {
        // 'unread' index
        name: 'unread',
        lower: [conversationId],
        upper: [conversationId, Number.MAX_VALUE],
      },
    })
  );

  return messages;
}

async function getMessagesByConversation(
  conversationId,
  { limit = 100, receivedAt = Number.MAX_VALUE, MessageCollection }
) {
  const messages = new MessageCollection();

  const options = {
    limit,
    index: {
      // 'conversation' index on [conversationId, received_at]
      name: 'conversation',
      lower: [conversationId],
      upper: [conversationId, receivedAt],
      order: 'desc',
      // SELECT messages WHERE conversationId = this.id ORDER
      // received_at DESC
    },
  };
  await deferredToPromise(messages.fetch(options));

  return messages;
}

async function removeAllMessagesInConversation(
  conversationId,
  { MessageCollection }
) {
  const messages = new MessageCollection();

  let loaded;
  do {
    // Yes, we really want the await in the loop. We're deleting 100 at a
    //   time so we don't use too much memory.
    // eslint-disable-next-line no-await-in-loop
    await deferredToPromise(
      messages.fetch({
        limit: 100,
        index: {
          // 'conversation' index on [conversationId, received_at]
          name: 'conversation',
          lower: [conversationId],
          upper: [conversationId, Number.MAX_VALUE],
        },
      })
    );

    loaded = messages.models;
    messages.reset([]);

    // Note: It's very important that these models are fully hydrated because
    //   we need to delete all associated on-disk files along with the database delete.
    loaded.map(message => message.destroy());
  } while (loaded.length > 0);
}

async function getMessagesBySentAt(sentAt, { MessageCollection }) {
  const messages = new MessageCollection();

  await deferredToPromise(
    messages.fetch({
      index: {
        // 'receipt' index on sent_at
        name: 'receipt',
        only: sentAt,
      },
    })
  );

  return messages;
}

async function getExpiredMessages({ MessageCollection }) {
  window.log.info('Load expired messages');
  const messages = new MessageCollection();

  await deferredToPromise(
    messages.fetch({
      conditions: {
        expires_at: {
          $lte: Date.now(),
        },
      },
    })
  );

  return messages;
}

async function getNextExpiringMessage({ MessageCollection }) {
  const messages = new MessageCollection();

  await deferredToPromise(
    messages.fetch({
      limit: 1,
      index: {
        name: 'expires_at',
      },
    })
  );

  return messages;
}

async function saveUnprocessed(data, { Unprocessed }) {
  const unprocessed = new Unprocessed(data);
  return deferredToPromise(unprocessed.save());
}

async function getAllUnprocessed({ UnprocessedCollection }) {
  const collection = new UnprocessedCollection();
  await deferredToPromise(collection.fetch());
  return collection.map(model => model.attributes);
}

async function updateUnprocessed(id, updates, { Unprocessed }) {
  const unprocessed = new Unprocessed({
    id,
  });

  await deferredToPromise(unprocessed.fetch());

  unprocessed.set(updates);
  await saveUnprocessed(unprocessed.attributes, { Unprocessed });
}

async function removeUnprocessed(id, { Unprocessed }) {
  const unprocessed = new Unprocessed({
    id,
  });

  await deferredToPromise(unprocessed.destroy());
}

async function removeAllUnprocessed() {
  // erase everything in unprocessed table
}

async function removeAll() {
  // erase everything in the database
}

async function getMessagesNeedingUpgrade(limit, { MessageCollection }) {
  const messages = new MessageCollection();

  await deferredToPromise(
    messages.fetch({
      limit,
      index: {
        name: 'schemaVersion',
        upper: MessageType.CURRENT_SCHEMA_VERSION,
        excludeUpper: true,
        order: 'desc',
      },
    })
  );

  const models = messages.models || [];
  return models.map(model => model.toJSON());
}

async function getMessagesWithVisualMediaAttachments(
  conversationId,
  { limit, MessageCollection }
) {
  const messages = new MessageCollection();
  const lowerReceivedAt = 0;
  const upperReceivedAt = Number.MAX_VALUE;

  await deferredToPromise(
    messages.fetch({
      limit,
      index: {
        name: 'hasVisualMediaAttachments',
        lower: [conversationId, lowerReceivedAt, 1],
        upper: [conversationId, upperReceivedAt, 1],
        order: 'desc',
      },
    })
  );

  return messages.models.map(model => model.toJSON());
}

async function getMessagesWithFileAttachments(
  conversationId,
  { limit, MessageCollection }
) {
  const messages = new MessageCollection();
  const lowerReceivedAt = 0;
  const upperReceivedAt = Number.MAX_VALUE;

  await deferredToPromise(
    messages.fetch({
      limit,
      index: {
        name: 'hasFileAttachments',
        lower: [conversationId, lowerReceivedAt, 1],
        upper: [conversationId, upperReceivedAt, 1],
        order: 'desc',
      },
    })
  );

  return messages.models.map(model => model.toJSON());
}

module.exports = {
  saveMessage,
  removeMessage,
  getUnreadByConversation,
  removeAllMessagesInConversation,
  getMessageBySender,
  getMessageById,
  getAllMessageIds,
  getMessagesBySentAt,
  getExpiredMessages,
  getNextExpiringMessage,
  getMessagesByConversation,

  getAllUnprocessed,
  saveUnprocessed,
  updateUnprocessed,
  removeUnprocessed,
  removeAllUnprocessed,

  removeAll,

  // Returning plain JSON
  getMessagesNeedingUpgrade,
  getMessagesWithVisualMediaAttachments,
  getMessagesWithFileAttachments,
};

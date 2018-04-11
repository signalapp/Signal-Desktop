exports.run = (transaction) => {
  const messagesStore = transaction.objectStore('messages');

  [
    'numAttachments',
    'numVisualMediaAttachments',
    'numFileAttachments',
  ].forEach((name) => {
    console.log(`Create message attachment metadata index: '${name}'`);
    messagesStore.createIndex(
      name,
      ['conversationId', 'received_at', name],
      { unique: false }
    );
  });
};

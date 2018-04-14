exports.run = (transaction) => {
  const messagesStore = transaction.objectStore('messages');

  [
    'hasAttachments',
    'hasVisualMediaAttachments',
    'hasFileAttachments',
  ].forEach((name) => {
    console.log(`Create message attachment metadata index: '${name}'`);
    messagesStore.createIndex(
      name,
      ['conversationId', name, 'received_at'],
      { unique: false }
    );
  });
};

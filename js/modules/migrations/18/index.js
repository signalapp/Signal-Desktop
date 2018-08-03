exports.run = ({ transaction, logger }) => {
  const messagesStore = transaction.objectStore('messages');

  logger.info("Create message attachment metadata index: 'hasAttachments'");
  messagesStore.createIndex(
    'hasAttachments',
    ['conversationId', 'hasAttachments', 'received_at'],
    { unique: false }
  );

  ['hasVisualMediaAttachments', 'hasFileAttachments'].forEach(name => {
    logger.info(`Create message attachment metadata index: '${name}'`);
    messagesStore.createIndex(name, ['conversationId', 'received_at', name], {
      unique: false,
    });
  });
};

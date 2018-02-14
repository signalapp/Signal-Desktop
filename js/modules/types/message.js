const Attachment = require('./attachment');

exports.GROUP = 'group';
exports.PRIVATE = 'private';

// Message -> Promise Message
exports.upgradeSchema = async message =>
  Object.assign({}, message, {
    attachments:
      await Promise.all(message.attachments.map(Attachment.upgradeSchema)),
  });

const Attachment = require('./attachment');


const GROUP = 'group';
const PRIVATE = 'private';

// Public API
exports.GROUP = GROUP;
exports.PRIVATE = PRIVATE;

// Schema
// Message -> Promise Message
exports.upgradeSchema = async message =>
  Object.assign({}, message, {
    attachments:
      await Promise.all(message.attachments.map(Attachment.upgradeSchema)),
  });

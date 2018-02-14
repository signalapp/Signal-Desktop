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

// Descriptors
exports.getGroupDescriptor = group => ({
  type: GROUP,
  id: group.id,
});

// Matches data from `libtextsecure` `MessageReceiver::handleSentMessage`:
exports.getDescriptorForSent = ({ message, destination }) => (
  message.group
    ? exports.getGroupDescriptor(message.group)
    : { type: PRIVATE, id: destination }
);

// Matches data from `libtextsecure` `MessageReceiver::handleDataMessage`:
exports.getDescriptorForReceived = ({ message, source }) => (
  message.group
    ? exports.getGroupDescriptor(message.group)
    : { type: PRIVATE, id: source }
);

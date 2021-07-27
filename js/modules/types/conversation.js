/* global crypto */

const { isFunction, isNumber } = require('lodash');
const { createLastMessageUpdate } = require('../../../ts/types/Conversation');
const { arrayBufferToBase64 } = require('../crypto');

async function computeHash(arraybuffer) {
  const hash = await crypto.subtle.digest({ name: 'SHA-512' }, arraybuffer);
  return arrayBufferToBase64(hash);
}

function buildAvatarUpdater({ field }) {
  return async (conversation, data, options = {}) => {
    if (!conversation) {
      return conversation;
    }

    const avatar = conversation[field];
    const { writeNewAttachmentData, deleteAttachmentData } = options;
    if (!isFunction(writeNewAttachmentData)) {
      throw new Error('Conversation.buildAvatarUpdater: writeNewAttachmentData must be a function');
    }
    if (!isFunction(deleteAttachmentData)) {
      throw new Error('Conversation.buildAvatarUpdater: deleteAttachmentData must be a function');
    }

    const newHash = await computeHash(data);

    if (!avatar || !avatar.hash) {
      return {
        ...conversation,
        [field]: {
          hash: newHash,
          path: await writeNewAttachmentData(data),
        },
      };
    }

    const { hash, path } = avatar;

    if (hash === newHash) {
      return conversation;
    }

    await deleteAttachmentData(path);

    return {
      ...conversation,
      [field]: {
        hash: newHash,
        path: await writeNewAttachmentData(data),
      },
    };
  };
}

const maybeUpdateAvatar = buildAvatarUpdater({ field: 'avatar' });

async function deleteExternalFiles(conversation, options = {}) {
  if (!conversation) {
    return;
  }

  const { deleteAttachmentData } = options;
  if (!isFunction(deleteAttachmentData)) {
    throw new Error('Conversation.buildAvatarUpdater: deleteAttachmentData must be a function');
  }

  const { avatar, profileAvatar } = conversation;

  if (avatar && avatar.path) {
    await deleteAttachmentData(avatar.path);
  }

  if (profileAvatar && profileAvatar.path) {
    await deleteAttachmentData(profileAvatar.path);
  }
}

module.exports = {
  deleteExternalFiles,
  maybeUpdateAvatar,
  createLastMessageUpdate,
  arrayBufferToBase64,
};

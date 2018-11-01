/* global crypto */

const { isFunction, isNumber } = require('lodash');
const { createLastMessageUpdate } = require('../../../ts/types/Conversation');
const { arrayBufferToBase64, base64ToArrayBuffer } = require('../crypto');

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
      throw new Error(
        'Conversation.buildAvatarUpdater: writeNewAttachmentData must be a function'
      );
    }
    if (!isFunction(deleteAttachmentData)) {
      throw new Error(
        'Conversation.buildAvatarUpdater: deleteAttachmentData must be a function'
      );
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
const maybeUpdateProfileAvatar = buildAvatarUpdater({
  field: 'profileAvatar',
});

async function upgradeToVersion2(conversation, options) {
  if (conversation.version >= 2) {
    return conversation;
  }

  const { writeNewAttachmentData } = options;
  if (!isFunction(writeNewAttachmentData)) {
    throw new Error(
      'Conversation.upgradeToVersion2: writeNewAttachmentData must be a function'
    );
  }

  let { avatar, profileAvatar, profileKey } = conversation;

  if (avatar && avatar.data) {
    avatar = {
      hash: await computeHash(avatar.data),
      path: await writeNewAttachmentData(avatar.data),
    };
  }

  if (profileAvatar && profileAvatar.data) {
    profileAvatar = {
      hash: await computeHash(profileAvatar.data),
      path: await writeNewAttachmentData(profileAvatar.data),
    };
  }

  if (profileKey && profileKey.byteLength) {
    profileKey = arrayBufferToBase64(profileKey);
  }

  return {
    ...conversation,
    version: 2,
    avatar,
    profileAvatar,
    profileKey,
  };
}

async function migrateConversation(conversation, options = {}) {
  if (!conversation) {
    return conversation;
  }
  if (!isNumber(conversation.version)) {
    // eslint-disable-next-line no-param-reassign
    conversation.version = 1;
  }

  return upgradeToVersion2(conversation, options);
}

async function deleteExternalFiles(conversation, options = {}) {
  if (!conversation) {
    return;
  }

  const { deleteAttachmentData } = options;
  if (!isFunction(deleteAttachmentData)) {
    throw new Error(
      'Conversation.buildAvatarUpdater: deleteAttachmentData must be a function'
    );
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
  migrateConversation,
  maybeUpdateAvatar,
  maybeUpdateProfileAvatar,
  createLastMessageUpdate,
  arrayBufferToBase64,
  base64ToArrayBuffer,
};

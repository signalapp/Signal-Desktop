import Queue from 'queue-promise';
import ByteBuffer from 'bytebuffer';
import _ from 'lodash';

import { downloadAttachment } from './attachments';

import { allowOnlyOneAtATime, hasAlreadyOneAtaTimeMatching } from '../session/utils/Promise';
import { toHex } from '../session/utils/String';
import { processNewAttachment } from '../types/MessageAttachment';
import { MIME } from '../types';
import { autoScaleForIncomingAvatar } from '../util/attachmentsUtil';
import { decryptProfile } from '../util/crypto/profileEncrypter';
import { ConversationModel } from '../models/conversation';
import { SignalService } from '../protobuf';
import { getConversationController } from '../session/conversations';
import { UserUtils } from '../session/utils';

const queue = new Queue({
  concurrent: 1,
  interval: 500,
});

queue.on('reject', error => {
  window.log.warn('[profileupdate] task profile image update failed with', error);
});

export async function appendFetchAvatarAndProfileJob(
  conversation: ConversationModel,
  profileInDataMessage: SignalService.DataMessage.ILokiProfile,
  profileKey?: Uint8Array | null // was any
) {
  if (!conversation?.id) {
    window?.log?.warn('[profileupdate] Cannot update profile with empty convoid');
    return;
  }
  const oneAtaTimeStr = `appendFetchAvatarAndProfileJob:${conversation.id}`;

  if (hasAlreadyOneAtaTimeMatching(oneAtaTimeStr)) {
    // window.log.debug(
    //   '[profileupdate] not adding another task of "appendFetchAvatarAndProfileJob" as there is already one scheduled for the conversation: ',
    //   conversation.id
    // );
    return;
  }
  // window.log.info(`[profileupdate] queuing fetching avatar for ${conversation.id}`);
  const task = allowOnlyOneAtATime(oneAtaTimeStr, async () => {
    return createOrUpdateProfile(conversation, profileInDataMessage, profileKey);
  });

  queue.enqueue(async () => task);
}

/**
 * This function should be used only when we have to do a sync update to our conversation with a new profile/avatar image or display name
 * It tries to fetch the profile image, scale it, save it, and update the conversationModel
 */
export async function updateOurProfileSync(
  profileInDataMessage: SignalService.DataMessage.ILokiProfile,
  profileKey?: Uint8Array | null // was any
) {
  const ourConvo = getConversationController().get(UserUtils.getOurPubKeyStrFromCache());
  if (!ourConvo?.id) {
    window?.log?.warn('[profileupdate] Cannot update our profile with empty convoid');
    return;
  }
  const oneAtaTimeStr = `appendFetchAvatarAndProfileJob:${ourConvo.id}`;
  return allowOnlyOneAtATime(oneAtaTimeStr, async () => {
    return createOrUpdateProfile(ourConvo, profileInDataMessage, profileKey);
  });
}

/**
 * Creates a new profile from the profile provided. Creates the profile if it doesn't exist.
 */
async function createOrUpdateProfile(
  conversation: ConversationModel,
  profileInDataMessage: SignalService.DataMessage.ILokiProfile,
  profileKey?: Uint8Array | null
) {
  if (!conversation.isPrivate()) {
    window.log.warn('createOrUpdateProfile can only be used for private convos');
    return;
  }

  const existingDisplayName = conversation.get('displayNameInProfile');
  const newDisplayName = profileInDataMessage.displayName;

  let changes = false;
  if (existingDisplayName !== newDisplayName) {
    changes = true;
    conversation.set('displayNameInProfile', newDisplayName || undefined);
  }

  if (profileInDataMessage.profilePicture && profileKey) {
    const prevPointer = conversation.get('avatarPointer');
    const needsUpdate =
      !prevPointer || !_.isEqual(prevPointer, profileInDataMessage.profilePicture);

    if (needsUpdate) {
      try {
        window.log.debug(`[profileupdate] starting downloading task for  ${conversation.id}`);
        const downloaded = await downloadAttachment({
          url: profileInDataMessage.profilePicture,
          isRaw: true,
        });

        // null => use placeholder with color and first letter
        let path = null;
        if (profileKey) {
          // Convert profileKey to ArrayBuffer, if needed
          const encoding = typeof profileKey === 'string' ? 'base64' : undefined;
          try {
            const profileKeyArrayBuffer = ByteBuffer.wrap(profileKey, encoding).toArrayBuffer();
            const decryptedData = await decryptProfile(downloaded.data, profileKeyArrayBuffer);
            window.log.info(
              `[profileupdate] about to auto scale avatar for convo ${conversation.id}`
            );

            const scaledData = await autoScaleForIncomingAvatar(decryptedData);
            const upgraded = await processNewAttachment({
              data: await scaledData.blob.arrayBuffer(),
              contentType: MIME.IMAGE_UNKNOWN, // contentType is mostly used to generate previews and screenshot. We do not care for those in this case.
            });
            // Only update the convo if the download and decrypt is a success
            conversation.set('avatarPointer', profileInDataMessage.profilePicture);
            conversation.set('profileKey', toHex(profileKey));
            ({ path } = upgraded);
          } catch (e) {
            window?.log?.error(`[profileupdate] Could not decrypt profile image: ${e}`);
          }
        }
        conversation.set({ avatarInProfile: path || undefined });

        changes = true;
      } catch (e) {
        window.log.warn(
          `[profileupdate] Failed to download attachment at ${profileInDataMessage.profilePicture}. Maybe it expired? ${e.message}`
        );
        // do not return here, we still want to update the display name even if the avatar failed to download
      }
    }
  } else if (profileKey) {
    conversation.set({ avatarInProfile: undefined });
  }

  if (changes) {
    await conversation.commit();
  }
}

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
import { ConversationModel, ConversationTypeEnum } from '../models/conversation';
import { SignalService } from '../protobuf';
import { getConversationController } from '../session/conversations';
import { UserUtils } from '../session/utils';

const queue = new Queue({
  concurrent: 1,
  interval: 500,
});

queue.on('reject', error => {
  window.log.warn('[profile-update] task profile image update failed with', error);
});

export async function appendFetchAvatarAndProfileJob(
  conversation: ConversationModel,
  profile: SignalService.DataMessage.ILokiProfile,
  profileKey?: Uint8Array | null // was any
) {
  if (!conversation?.id) {
    window?.log?.warn('[profile-update] Cannot update profile with empty convoid');
    return;
  }
  const oneAtaTimeStr = `appendFetchAvatarAndProfileJob:${conversation.id}`;

  if (hasAlreadyOneAtaTimeMatching(oneAtaTimeStr)) {
    // window.log.debug(
    //   '[profile-update] not adding another task of "appendFetchAvatarAndProfileJob" as there is already one scheduled for the conversation: ',
    //   conversation.id
    // );
    return;
  }
  window.log.info(`[profile-update] queuing fetching avatar for ${conversation.id}`);
  const task = allowOnlyOneAtATime(oneAtaTimeStr, async () => {
    return createOrUpdateProfile(conversation, profile, profileKey);
  });

  queue.enqueue(async () => task);
}

/**
 * This function should be used only when we have to do a sync update to our conversation with a new profile/avatar image or display name
 * It tries to fetch the profile image, scale it, save it, and update the conversationModel
 */
export async function updateOurProfileSync(
  profile: SignalService.DataMessage.ILokiProfile,
  profileKey?: Uint8Array | null // was any
) {
  const ourConvo = getConversationController().get(UserUtils.getOurPubKeyStrFromCache());
  if (!ourConvo?.id) {
    window?.log?.warn('[profile-update] Cannot update our profile with empty convoid');
    return;
  }
  const oneAtaTimeStr = `appendFetchAvatarAndProfileJob:${ourConvo.id}`;
  return allowOnlyOneAtATime(oneAtaTimeStr, async () => {
    return createOrUpdateProfile(ourConvo, profile, profileKey);
  });
}

/**
 * Creates a new profile from the profile provided. Creates the profile if it doesn't exist.
 */
async function createOrUpdateProfile(
  conversation: ConversationModel,
  profile: SignalService.DataMessage.ILokiProfile,
  profileKey?: Uint8Array | null
) {
  // Retain old values unless changed:
  const newProfile = conversation.get('profile') || {};

  let changes = false;
  if (newProfile.displayName !== profile.displayName) {
    changes = true;
  }
  newProfile.displayName = profile.displayName;

  if (profile.profilePicture && profileKey) {
    const prevPointer = conversation.get('avatarPointer');
    const needsUpdate = !prevPointer || !_.isEqual(prevPointer, profile.profilePicture);

    if (needsUpdate) {
      try {
        window.log.debug(`[profile-update] starting downloading task for  ${conversation.id}`);
        const downloaded = await downloadAttachment({
          url: profile.profilePicture,
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
              `[profile-update] about to auto scale avatar for convo ${conversation.id}`
            );

            const scaledData = await autoScaleForIncomingAvatar(decryptedData);
            const upgraded = await processNewAttachment({
              data: await scaledData.blob.arrayBuffer(),
              contentType: MIME.IMAGE_UNKNOWN, // contentType is mostly used to generate previews and screenshot. We do not care for those in this case.
            });
            // Only update the convo if the download and decrypt is a success
            conversation.set('avatarPointer', profile.profilePicture);
            conversation.set('profileKey', toHex(profileKey));
            ({ path } = upgraded);
          } catch (e) {
            window?.log?.error(`[profile-update] Could not decrypt profile image: ${e}`);
          }
        }
        newProfile.avatar = path;
        changes = true;
      } catch (e) {
        window.log.warn(
          `[profile-update] Failed to download attachment at ${profile.profilePicture}. Maybe it expired? ${e.message}`
        );
        // do not return here, we still want to update the display name even if the avatar failed to download
      }
    }
  } else if (profileKey) {
    if (newProfile.avatar !== null) {
      changes = true;
    }
    newProfile.avatar = null;
  }

  const conv = await getConversationController().getOrCreateAndWait(
    conversation.id,
    ConversationTypeEnum.PRIVATE
  );
  await conv.setLokiProfile(newProfile);
  if (changes) {
    await conv.commit();
  }
}

import { to_hex } from 'libsodium-wrappers-sumo';
import { isEmpty } from 'lodash';
import { getConversationController } from '../conversations';
import { UserUtils } from '../utils';
import { runners } from '../utils/job_runners/JobRunner';
import {
  AvatarDownloadJob,
  shouldAddAvatarDownloadJob,
} from '../utils/job_runners/jobs/AvatarDownloadJob';

/**
 * This can be used to update our conversation display name with the given name right away, and plan an AvatarDownloadJob to retrieve the new avatar if needed to download it
 */
async function updateOurProfileSync(
  displayName: string | undefined,
  profileUrl: string | null,
  profileKey: Uint8Array | null
) {
  const ourConvo = getConversationController().get(UserUtils.getOurPubKeyStrFromCache());
  if (!ourConvo?.id) {
    window?.log?.warn('[profileupdate] Cannot update our profile with empty convoid');
    return;
  }

  return updateProfileOfContact(
    UserUtils.getOurPubKeyStrFromCache(),
    displayName,
    profileUrl,
    profileKey
  );
}

/**
 * This can be used to update the display name of the given pubkey right away, and plan an AvatarDownloadJob to retrieve the new avatar if needed to download it.
 */
async function updateProfileOfContact(
  pubkey: string,
  displayName: string | null | undefined,
  profileUrl: string | null | undefined,
  profileKey: Uint8Array | null | undefined
) {
  const conversation = getConversationController().get(pubkey);

  if (!conversation || !conversation.isPrivate()) {
    window.log.warn('updateProfileOfContact can only be used for existing and private convos');
    return;
  }

  const existingDisplayName = conversation.get('displayNameInProfile');

  // avoid setting the display name to an invalid value
  if (existingDisplayName !== displayName && !isEmpty(displayName)) {
    conversation.set('displayNameInProfile', displayName || undefined);
    await conversation.commit();
  }
  // add an avatar download job only if needed

  const profileKeyHex = !profileKey || isEmpty(profileKey) ? null : to_hex(profileKey);
  if (shouldAddAvatarDownloadJob({ pubkey, profileUrl, profileKeyHex })) {
    const avatarDownloadJob = new AvatarDownloadJob({
      conversationId: pubkey,
      profileKeyHex,
      profilePictureUrl: profileUrl || null,
    });

    await runners.avatarDownloadRunner.addJob(avatarDownloadJob);
  }
}

export const ProfileManager = {
  updateOurProfileSync,
  updateProfileOfContact,
};

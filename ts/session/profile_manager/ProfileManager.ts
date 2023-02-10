import { isEmpty } from 'lodash';
import { getConversationController } from '../conversations';
import { UserUtils } from '../utils';
import { AvatarDownload } from '../utils/job_runners/jobs/AvatarDownloadJob';
import { toHex } from '../utils/String';

/**
 * This can be used to update our conversation display name with the given name right away, and plan an AvatarDownloadJob to retrieve the new avatar if needed to download it
 */
async function updateOurProfileSync(
  displayName: string | undefined,
  profileUrl: string | null,
  profileKey: Uint8Array | null
) {
  const us = UserUtils.getOurPubKeyStrFromCache();
  const ourConvo = getConversationController().get(us);
  if (!ourConvo?.id) {
    window?.log?.warn('[profileupdate] Cannot update our profile without convo associated');
    return;
  }

  return updateProfileOfContact(us, displayName, profileUrl, profileKey);
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
    console.warn(
      `updateProfileOfContact overriding old "${existingDisplayName}: with "${displayName}"`
    );

    conversation.set('displayNameInProfile', displayName || undefined);
    await conversation.commit();
  }
  // add an avatar download job only if needed
  const profileKeyHex = !profileKey || isEmpty(profileKey) ? null : toHex(profileKey);
  await AvatarDownload.addAvatarDownloadJobIfNeeded({
    profileKeyHex,
    profileUrl,
    pubkey,
  });
}

export const ProfileManager = {
  updateOurProfileSync,
  updateProfileOfContact,
};

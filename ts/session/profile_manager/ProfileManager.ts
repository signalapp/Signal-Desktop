import { isEmpty } from 'lodash';
import { getConversationController } from '../conversations';
import { UserUtils } from '../utils';
import { toHex } from '../utils/String';
import { AvatarDownload } from '../utils/job_runners/jobs/AvatarDownloadJob';

export type Profile = {
  displayName: string | undefined;
  profileUrl: string | null;
  profileKey: Uint8Array | null;
  priority: number | null; // passing null means to not update the priority at all (used for legacy config message for now)
};

/**
 * This can be used to update our conversation display name with the given name right away, and plan an AvatarDownloadJob to retrieve the new avatar if needed to download it
 */
async function updateOurProfileSync({ displayName, profileUrl, profileKey, priority }: Profile) {
  const us = UserUtils.getOurPubKeyStrFromCache();
  const ourConvo = getConversationController().get(us);
  if (!ourConvo?.id) {
    window?.log?.warn('[profileupdate] Cannot update our profile without convo associated');
    return;
  }

  await updateProfileOfContact(us, displayName, profileUrl, profileKey);
  if (priority !== null && ourConvo.get('priority') !== priority) {
    ourConvo.set('priority', priority);
    await ourConvo.commit();
  }
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
  // TODO we should make sure that this function does not get call directly when `updateOurProfileSync` should be called instead. I.e. for avatars received in messages from ourself
  if (!conversation || !conversation.isPrivate()) {
    window.log.warn('updateProfileOfContact can only be used for existing and private convos');
    return;
  }
  let changes = false;
  const existingDisplayName = conversation.get('displayNameInProfile');

  // avoid setting the display name to an invalid value
  if (existingDisplayName !== displayName && !isEmpty(displayName)) {
    conversation.set('displayNameInProfile', displayName || undefined);
    changes = true;
  }

  const profileKeyHex = !profileKey || isEmpty(profileKey) ? null : toHex(profileKey);

  let avatarChanged = false;
  // trust whatever we get as an update. It either comes from a shared config wrapper or one of that user's message. But in any case we should trust it, even if it gets resetted.
  const prevPointer = conversation.get('avatarPointer');
  const prevProfileKey = conversation.get('profileKey');

  // we have to set it right away and not in the async download job, as the next .commit will save it to the
  // database and wrapper (and we do not want to override anything in the wrapper's content
  // with what we have locally, so we need the commit to have already the right values in pointer and profileKey)
  if (prevPointer !== profileUrl || prevProfileKey !== profileKeyHex) {
    conversation.set({
      avatarPointer: profileUrl || undefined,
      profileKey: profileKeyHex || undefined,
    });

    // if the avatar data we had before is not the same of what we received, we need to schedule a new avatar download job.
    avatarChanged = true; // allow changes from strings to null/undefined to trigger a AvatarDownloadJob. If that happens, we want to remove the local attachment file.
  }

  // if we have a local path to an downloaded  avatar, but no corresponding url/key for it, it means that
  // the avatar was most likely removed so let's remove our link to that file.
  if ((!profileUrl || !profileKeyHex) && conversation.get('avatarInProfile')) {
    conversation.set({ avatarInProfile: undefined });
    changes = true;
  }

  if (changes) {
    await conversation.commit();
  }

  if (avatarChanged) {
    // this call will download the new avatar or reset the local filepath if needed
    await AvatarDownload.addAvatarDownloadJob({
      conversationId: pubkey,
    });
  }
}

export const ProfileManager = {
  updateOurProfileSync,
  updateProfileOfContact,
};

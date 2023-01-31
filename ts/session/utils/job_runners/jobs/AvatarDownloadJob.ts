import { isEmpty, isEqual, isNumber } from 'lodash';
import { v4 } from 'uuid';
import { UserUtils } from '../..';
import { downloadAttachment } from '../../../../receiver/attachments';
import { MIME } from '../../../../types';
import { processNewAttachment } from '../../../../types/MessageAttachment';
import { autoScaleForIncomingAvatar } from '../../../../util/attachmentsUtil';
import { decryptProfile } from '../../../../util/crypto/profileEncrypter';
import { getConversationController } from '../../../conversations';
import { fromHexToArray } from '../../String';
import { AvatarDownloadPersistedData, PersistedJob } from '../PersistedJob';

const defaultMsBetweenRetries = 10000;
const defaultMaxAttemps = 3;

/**
 * Returns true if given those details we should add an Avatar Download Job to the list of jobs to run
 */
export function shouldAddAvatarDownloadJob({
  profileKeyHex,
  profileUrl,
  pubkey,
}: {
  pubkey: string;
  profileUrl: string | null | undefined;
  profileKeyHex: string | null | undefined;
}) {
  const conversation = getConversationController().get(pubkey);
  if (!conversation) {
    // return true so we do not retry this task.
    window.log.warn('shouldAddAvatarDownloadJob did not corresponding conversation');

    return false;
  }
  if (!conversation.isPrivate()) {
    window.log.warn('shouldAddAvatarDownloadJob can only be used for private convos currently');
    return false;
  }
  if (profileUrl && !isEmpty(profileKeyHex)) {
    const prevPointer = conversation.get('avatarPointer');
    const needsUpdate = !prevPointer || !isEqual(prevPointer, profileUrl);

    return needsUpdate;
  }
  return false;
}

/**
 * This job can be used to add the downloading of the avatar of a conversation to the list of jobs to be run.
 * The conversationId is used as identifier so we can only have a single job per conversation.
 * When the jobRunners starts this job, the job first checks if a download is required or not (avatarPointer changed and wasn't already downloaded).
 * If yes, it downloads the new avatar, decrypt it and store it before updating the conversation with the new url,profilekey and local file storage.
 */
export class AvatarDownloadJob extends PersistedJob<AvatarDownloadPersistedData> {
  constructor({
    conversationId,
    nextAttemptTimestamp,
    maxAttempts,
    currentRetry,
    profileKeyHex,
    profilePictureUrl,
    identifier,
  }: Pick<AvatarDownloadPersistedData, 'profileKeyHex' | 'profilePictureUrl'> & {
    conversationId: string;
  } & Partial<
      Pick<
        AvatarDownloadPersistedData,
        | 'nextAttemptTimestamp'
        | 'identifier'
        | 'maxAttempts'
        | 'delayBetweenRetries'
        | 'currentRetry'
      >
    >) {
    super({
      jobType: 'AvatarDownloadJobType',
      identifier: identifier || v4(),
      conversationId,
      delayBetweenRetries: defaultMsBetweenRetries,
      maxAttempts: isNumber(maxAttempts) ? maxAttempts : defaultMaxAttemps,
      nextAttemptTimestamp: nextAttemptTimestamp || Date.now() + defaultMsBetweenRetries,
      currentRetry: isNumber(currentRetry) ? currentRetry : 0,
      profileKeyHex,
      profilePictureUrl,
    });
  }

  // tslint:disable-next-line: cyclomatic-complexity
  public async run(): Promise<boolean> {
    const convoId = this.persistedData.conversationId;

    window.log.warn(
      `running job ${this.persistedData.jobType} with conversationId:"${convoId}" id:"${this.persistedData.identifier}" `
    );

    if (!this.persistedData.identifier || !convoId) {
      // return true so we do not retry this task.
      return true;
    }

    let conversation = getConversationController().get(convoId);
    if (!conversation) {
      // return true so we do not retry this task.
      window.log.warn('AvatarDownloadJob did not corresponding conversation');

      return true;
    }
    if (!conversation.isPrivate()) {
      window.log.warn('AvatarDownloadJob can only be used for private convos currently');
      return true;
    }
    let changes = false;

    const shouldRunJob = shouldAddAvatarDownloadJob({
      pubkey: convoId,
      profileKeyHex: this.persistedData.profileKeyHex,
      profileUrl: this.persistedData.profilePictureUrl,
    });
    if (!shouldRunJob) {
      // return true so we do not retry this task.
      window.log.warn('AvatarDownloadJob shouldAddAvatarDownloadJob said no');

      return true;
    }

    if (this.persistedData.profilePictureUrl && this.persistedData.profileKeyHex) {
      const prevPointer = conversation.get('avatarPointer');
      const needsUpdate =
        !prevPointer || !isEqual(prevPointer, this.persistedData.profilePictureUrl);

      if (needsUpdate) {
        try {
          window.log.debug(`[profileupdate] starting downloading task for  ${conversation.id}`);
          const downloaded = await downloadAttachment({
            url: this.persistedData.profilePictureUrl,
            isRaw: true,
          });
          conversation = getConversationController().getOrThrow(convoId);

          // null => use placeholder with color and first letter
          let path = null;

          try {
            const profileKeyArrayBuffer = fromHexToArray(this.persistedData.profileKeyHex);
            const decryptedData = await decryptProfile(downloaded.data, profileKeyArrayBuffer);

            window.log.info(
              `[profileupdate] about to auto scale avatar for convo ${conversation.id}`
            );

            const scaledData = await autoScaleForIncomingAvatar(decryptedData);

            const upgraded = await processNewAttachment({
              data: await scaledData.blob.arrayBuffer(),
              contentType: MIME.IMAGE_UNKNOWN, // contentType is mostly used to generate previews and screenshot. We do not care for those in this case.
            });
            conversation = getConversationController().getOrThrow(convoId);

            // Only update the convo if the download and decrypt is a success
            conversation.set('avatarPointer', this.persistedData.profilePictureUrl);
            conversation.set('profileKey', this.persistedData.profileKeyHex || undefined);
            ({ path } = upgraded);
          } catch (e) {
            window?.log?.error(`[profileupdate] Could not decrypt profile image: ${e}`);
          }

          conversation.set({ avatarInProfile: path || undefined });

          changes = true;
        } catch (e) {
          window.log.warn(
            `[profileupdate] Failed to download attachment at ${this.persistedData.profilePictureUrl}. Maybe it expired? ${e.message}`
          );
          // do not return here, we still want to update the display name even if the avatar failed to download
        }
      }
    } else {
      if (
        conversation.get('avatarInProfile') ||
        conversation.get('avatarPointer') ||
        conversation.get('profileKey')
      ) {
        changes = true;
        conversation.set({
          avatarInProfile: undefined,
          avatarPointer: undefined,
          profileKey: undefined,
        });
      }
    }

    if (conversation.id === UserUtils.getOurPubKeyStrFromCache()) {
      // make sure the settings which should already set to `true` are
      if (
        !conversation.get('isTrustedForAttachmentDownload') ||
        !conversation.get('isApproved') ||
        !conversation.get('didApproveMe')
      ) {
        conversation.set({
          isTrustedForAttachmentDownload: true,
          isApproved: true,
          didApproveMe: true,
        });
        changes = true;
      }
    }

    if (changes) {
      await conversation.commit();
    }

    // return true so this job is marked as a success
    return true;
  }

  public serializeJob(): AvatarDownloadPersistedData {
    return super.serializeBase();
  }

  public nonRunningJobsToRemove(jobs: Array<AvatarDownloadPersistedData>) {
    // for an avatar download job, we want to remove any job matching the same conversationID.
    return jobs.filter(j => j.conversationId === this.persistedData.conversationId);
  }

  public addJobCheck(
    jobs: Array<AvatarDownloadPersistedData>
  ): 'skipAsJobTypeAlreadyPresent' | 'removeJobsFromQueue' | null {
    if (this.nonRunningJobsToRemove(jobs).length) {
      return 'removeJobsFromQueue';
    }
    return null;
  }
}

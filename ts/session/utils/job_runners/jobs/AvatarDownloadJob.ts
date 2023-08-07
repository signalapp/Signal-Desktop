import { isEmpty, isNumber, isString } from 'lodash';
import { v4 } from 'uuid';
import { UserUtils } from '../..';
import { downloadAttachment } from '../../../../receiver/attachments';
import { MIME } from '../../../../types';
import { processNewAttachment } from '../../../../types/MessageAttachment';
import { autoScaleForIncomingAvatar } from '../../../../util/attachmentsUtil';
import { decryptProfile } from '../../../../util/crypto/profileEncrypter';
import { getConversationController } from '../../../conversations';
import { fromHexToArray } from '../../String';
import { runners } from '../JobRunner';
import {
  AddJobCheckReturn,
  AvatarDownloadPersistedData,
  PersistedJob,
  RunJobResult,
} from '../PersistedJob';

const defaultMsBetweenRetries = 10000;
const defaultMaxAttemps = 3;

/**
 * Returns true if the provided conversationId is a private chat and that we should add an Avatar Download Job to the list of jobs to run.
 * Before calling this function, you have to update the related conversation profileKey and avatarPointer fields with the urls which should be downloaded, or reset them if you wanted them reset.
 */
export function shouldAddAvatarDownloadJob({ conversationId }: { conversationId: string }) {
  const conversation = getConversationController().get(conversationId);
  if (!conversation) {
    // return true so we do not retry this task.
    window.log.warn('shouldAddAvatarDownloadJob did not corresponding conversation');

    return false;
  }
  if (!conversation.isPrivate()) {
    window.log.warn('shouldAddAvatarDownloadJob can only be used for private convos currently');
    return false;
  }
  const prevPointer = conversation.get('avatarPointer');
  const profileKey = conversation.get('profileKey');
  const hasNoAvatar = isEmpty(prevPointer) || isEmpty(profileKey);

  if (hasNoAvatar) {
    return false;
  }

  return true;
}

async function addAvatarDownloadJob({ conversationId }: { conversationId: string }) {
  if (shouldAddAvatarDownloadJob({ conversationId })) {
    const avatarDownloadJob = new AvatarDownloadJob({
      conversationId,
      nextAttemptTimestamp: Date.now(),
    });
    window.log.debug(`addAvatarDownloadJobIfNeeded: adding job download for ${conversationId} `);
    await runners.avatarDownloadRunner.addJob(avatarDownloadJob);
  }
}

/**
 * This job can be used to add the downloading of the avatar of a conversation to the list of jobs to be run.
 * The conversationId is used as identifier so we can only have a single job per conversation.
 * When the jobRunners starts this job, the job first checks if a download is required or not (avatarPointer changed and wasn't already downloaded).
 * If yes, it downloads the new avatar, decrypt it and store it before updating the conversation with the new url,profilekey and local file storage.
 */
class AvatarDownloadJob extends PersistedJob<AvatarDownloadPersistedData> {
  constructor({
    conversationId,
    nextAttemptTimestamp,
    maxAttempts,
    currentRetry,
    identifier,
  }: Pick<AvatarDownloadPersistedData, 'conversationId'> &
    Partial<
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
    });
  }

  public async run(): Promise<RunJobResult> {
    const convoId = this.persistedData.conversationId;

    window.log.warn(
      `running job ${this.persistedData.jobType} with conversationId:"${convoId}" id:"${this.persistedData.identifier}" `
    );

    if (!this.persistedData.identifier || !convoId) {
      // return true so we do not retry this task.
      return RunJobResult.PermanentFailure;
    }

    let conversation = getConversationController().get(convoId);
    if (!conversation) {
      // return true so we do not retry this task.
      window.log.warn('AvatarDownloadJob did not corresponding conversation');

      return RunJobResult.PermanentFailure;
    }
    if (!conversation.isPrivate()) {
      window.log.warn('AvatarDownloadJob can only be used for private convos currently');
      return RunJobResult.PermanentFailure;
    }
    let changes = false;
    const toDownloadPointer = conversation.get('avatarPointer');
    const toDownloadProfileKey = conversation.get('profileKey');

    // if there is an avatar and profileKey for that user ('', null and undefined excluded), download, decrypt and save the avatar locally.
    if (toDownloadPointer && toDownloadProfileKey) {
      try {
        window.log.debug(`[profileupdate] starting downloading task for  ${conversation.id}`);
        const downloaded = await downloadAttachment({
          url: toDownloadPointer,
          isRaw: true,
        });
        conversation = getConversationController().getOrThrow(convoId);

        if (!downloaded.data.byteLength) {
          window.log.debug(`[profileupdate] downloaded data is empty for  ${conversation.id}`);
          return RunJobResult.RetryJobIfPossible; // so we retry this job
        }

        // null => use placeholder with color and first letter
        let path = null;

        try {
          const profileKeyArrayBuffer = fromHexToArray(toDownloadProfileKey);
          let decryptedData: ArrayBuffer;
          try {
            decryptedData = await decryptProfile(downloaded.data, profileKeyArrayBuffer);
          } catch (decryptError) {
            window.log.info(
              `[profileupdate] failed to decrypt downloaded data ${conversation.id} with provided profileKey`
            );
            // if we got content, but cannot decrypt it with the provided profileKey, there is no need to keep retrying.
            return RunJobResult.PermanentFailure;
          }

          window.log.info(
            `[profileupdate] about to auto scale avatar for convo ${conversation.id}`
          );

          // we autoscale incoming avatars because our app keeps decrypted avatars in memory and some platforms allows large avatars to be uploaded.
          const scaledData = await autoScaleForIncomingAvatar(decryptedData);

          const upgraded = await processNewAttachment({
            data: await scaledData.blob.arrayBuffer(),
            contentType: MIME.IMAGE_UNKNOWN, // contentType is mostly used to generate previews and screenshot. We do not care for those in this case.
          });
          conversation = getConversationController().getOrThrow(convoId);
          ({ path } = upgraded);
        } catch (e) {
          window?.log?.error(`[profileupdate] Could not decrypt profile image: ${e}`);
          return RunJobResult.RetryJobIfPossible; // so we retry this job
        }

        conversation.set({ avatarInProfile: path || undefined });

        changes = true;
      } catch (e) {
        // TODO would be nice to throw a specific exception here instead of relying on the error string.
        if (isString(e.message) && (e.message as string).includes('404')) {
          window.log.warn(
            `[profileupdate] Failed to download attachment at ${toDownloadPointer}. We got 404 error: "${e.message}"`
          );
          return RunJobResult.PermanentFailure;
        }
        window.log.warn(
          `[profileupdate] Failed to download attachment at ${toDownloadPointer}. Maybe it expired? ${e.message}`
        );
        return RunJobResult.RetryJobIfPossible;
      }
    } else if (conversation.get('avatarInProfile')) {
      // there is no valid avatar to download, make sure the local file of the avatar of that user is removed
      conversation.set({
        avatarInProfile: undefined,
      });
      changes = true;
    }

    if (conversation.id === UserUtils.getOurPubKeyStrFromCache()) {
      // make sure the settings which should already set to `true` are
      if (
        !conversation.get('isTrustedForAttachmentDownload') ||
        !conversation.isApproved() ||
        !conversation.didApproveMe()
      ) {
        conversation.set({
          isTrustedForAttachmentDownload: true,
        });
        await conversation.setDidApproveMe(true, false);
        await conversation.setIsApproved(true, false);
        changes = true;
      }
    }

    if (changes) {
      await conversation.commit();
    }

    // return true so this job is marked as a success
    return RunJobResult.Success;
  }

  public serializeJob(): AvatarDownloadPersistedData {
    return super.serializeBase();
  }

  public nonRunningJobsToRemove(_jobs: Array<AvatarDownloadPersistedData>) {
    return [];
  }

  public addJobCheck(jobs: Array<AvatarDownloadPersistedData>): AddJobCheckReturn {
    // avoid adding the same job if the exact same one is already planned
    const hasSameJob = jobs.some(j => {
      return j.conversationId === this.persistedData.conversationId;
    });

    if (hasSameJob) {
      return 'skipAddSameJobPresent';
    }

    return null;
  }

  public getJobTimeoutMs(): number {
    return 10000;
  }
}

export const AvatarDownload = {
  AvatarDownloadJob,
  addAvatarDownloadJob,
};

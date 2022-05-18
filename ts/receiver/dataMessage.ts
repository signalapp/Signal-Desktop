import { SignalService } from './../protobuf';
import { removeFromCache } from './cache';
import { EnvelopePlus } from './types';
import { getEnvelopeId } from './common';

import { PubKey } from '../session/types';
import { handleMessageJob, toRegularMessage } from './queuedJob';
import _ from 'lodash';
import { StringUtils, UserUtils } from '../session/utils';
import { getConversationController } from '../session/conversations';
import { handleClosedGroupControlMessage } from './closedGroups';
import { getMessageBySenderAndSentAt } from '../../ts/data/data';
import { ConversationModel, ConversationTypeEnum } from '../models/conversation';

import {
  createSwarmMessageSentFromNotUs,
  createSwarmMessageSentFromUs,
} from '../models/messageFactory';
import { MessageModel } from '../models/message';
import { isUsFromCache } from '../session/utils/User';
import { appendFetchAvatarAndProfileJob } from './userProfileImageUpdates';
import { toLogFormat } from '../types/attachments/Errors';

function cleanAttachment(attachment: any) {
  return {
    ..._.omit(attachment, 'thumbnail'),
    id: attachment.id.toString(),
    key: attachment.key ? StringUtils.decode(attachment.key, 'base64') : null,
    digest:
      attachment.digest && attachment.digest.length > 0
        ? StringUtils.decode(attachment.digest, 'base64')
        : null,
  };
}

function cleanAttachments(decrypted: SignalService.DataMessage) {
  const { quote, group } = decrypted;

  // Here we go from binary to string/base64 in all AttachmentPointer digest/key fields

  if (group && group.type === SignalService.GroupContext.Type.UPDATE) {
    if (group.avatar !== null) {
      group.avatar = cleanAttachment(group.avatar);
    }
  }

  decrypted.attachments = (decrypted.attachments || []).map(cleanAttachment);
  decrypted.preview = (decrypted.preview || []).map((item: any) => {
    const { image } = item;

    if (!image) {
      return item;
    }

    return {
      ...item,
      image: cleanAttachment(image),
    };
  });

  if (quote) {
    if (quote.id) {
      quote.id = _.toNumber(quote.id);
    }

    quote.attachments = (quote.attachments || []).map((item: any) => {
      const { thumbnail } = item;

      if (!thumbnail || thumbnail.length === 0) {
        return item;
      }

      return {
        ...item,
        thumbnail: cleanAttachment(item.thumbnail),
      };
    });
  }
}

export function isMessageEmpty(message: SignalService.DataMessage) {
  const { flags, body, attachments, group, quote, preview, openGroupInvitation } = message;

  return (
    !flags &&
    // FIXME remove this hack to drop auto friend requests messages in a few weeks 15/07/2020
    isBodyEmpty(body) &&
    _.isEmpty(attachments) &&
    _.isEmpty(group) &&
    _.isEmpty(quote) &&
    _.isEmpty(preview) &&
    _.isEmpty(openGroupInvitation)
  );
}

function isBodyEmpty(body: string) {
  return _.isEmpty(body);
}

async function cleanIncomingDataMessage(
  envelope: EnvelopePlus,
  rawDataMessage: SignalService.DataMessage
) {
  /* tslint:disable:no-bitwise */
  const FLAGS = SignalService.DataMessage.Flags;

  // Now that its decrypted, validate the message and clean it up for consumer
  //   processing
  // Note that messages may (generally) only perform one action and we ignore remaining
  //   fields after the first action.

  if (rawDataMessage.flags == null) {
    rawDataMessage.flags = 0;
  }
  if (rawDataMessage.expireTimer == null) {
    rawDataMessage.expireTimer = 0;
  }
  if (rawDataMessage.flags & FLAGS.EXPIRATION_TIMER_UPDATE) {
    rawDataMessage.body = '';
    rawDataMessage.attachments = [];
  } else if (rawDataMessage.flags !== 0) {
    throw new Error('Unknown flags in message');
  }

  const attachmentCount = rawDataMessage?.attachments?.length || 0;
  const ATTACHMENT_MAX = 32;
  if (attachmentCount > ATTACHMENT_MAX) {
    await removeFromCache(envelope);
    throw new Error(
      `Too many attachments: ${attachmentCount} included in one message, max is ${ATTACHMENT_MAX}`
    );
  }
  cleanAttachments(rawDataMessage);

  // if the decrypted dataMessage timestamp is not set, copy the one from the envelope
  if (!_.isFinite(rawDataMessage?.timestamp)) {
    rawDataMessage.timestamp = envelope.timestamp;
  }

  return rawDataMessage;
}

/**
 * We have a few origins possible
 *    - if the message is from a private conversation with a friend and he wrote to us,
 *        the conversation to add the message to is our friend pubkey, so envelope.source
 *    - if the message is from a medium group conversation
 *        * envelope.source is the medium group pubkey
 *        * envelope.senderIdentity is the author pubkey (the one who sent the message)
 *    - at last, if the message is a syncMessage,
 *        * envelope.source is our pubkey (our other device has the same pubkey as us)
 *        * dataMessage.syncTarget is either the group public key OR the private conversation this message is about.
 */
// tslint:disable-next-line: cyclomatic-complexity
export async function handleSwarmDataMessage(
  envelope: EnvelopePlus,
  sentAtTimestamp: number,
  rawDataMessage: SignalService.DataMessage,
  messageHash: string,
  senderConversationModel: ConversationModel
): Promise<void> {
  window.log.info('handleSwarmDataMessage');

  const cleanDataMessage = await cleanIncomingDataMessage(envelope, rawDataMessage);
  // we handle group updates from our other devices in handleClosedGroupControlMessage()
  if (cleanDataMessage.closedGroupControlMessage) {
    await handleClosedGroupControlMessage(
      envelope,
      cleanDataMessage.closedGroupControlMessage as SignalService.DataMessage.ClosedGroupControlMessage
    );
    return;
  }

  /**
   * This is a mess, but
   *
   * 1. if syncTarget is set and this is a synced message, syncTarget holds the conversationId in which this message is addressed. This syncTarget can be a private conversation pubkey or a closed group pubkey
   *
   * 2. for a closed group message, envelope.senderIdentity is the pubkey of the sender and envelope.source is the pubkey of the closed group.
   *
   * 3. for a private conversation message, envelope.senderIdentity and envelope.source are probably the pubkey of the sender.
   */
  const isSyncedMessage = Boolean(cleanDataMessage.syncTarget?.length);
  // no need to remove prefix here, as senderIdentity set => envelope.source is not used (and this is the one having the prefix when this is an opengroup)
  const convoIdOfSender = envelope.senderIdentity || envelope.source;
  const isMe = UserUtils.isUsFromCache(convoIdOfSender);

  if (isSyncedMessage && !isMe) {
    window?.log?.warn('Got a sync message from someone else than me. Dropping it.');
    return removeFromCache(envelope);
  } else if (isSyncedMessage) {
    // we should create the synTarget convo but I have no idea how to know if this is a private or closed group convo?
  }
  const convoIdToAddTheMessageTo = PubKey.removeTextSecurePrefixIfNeeded(
    isSyncedMessage ? cleanDataMessage.syncTarget : envelope.source
  );

  const convoToAddMessageTo = await getConversationController().getOrCreateAndWait(
    convoIdToAddTheMessageTo,
    envelope.senderIdentity ? ConversationTypeEnum.GROUP : ConversationTypeEnum.PRIVATE
  );

  window?.log?.info(
    `Handle dataMessage about convo ${convoIdToAddTheMessageTo} from user: ${convoIdOfSender}`
  );
  // remove the prefix from the source object so this is correct for all other

  // Check if we need to update any profile names
  if (
    !isMe &&
    senderConversationModel &&
    cleanDataMessage.profile &&
    cleanDataMessage.profileKey?.length
  ) {
    // do not await this
    void appendFetchAvatarAndProfileJob(
      senderConversationModel,
      cleanDataMessage.profile,
      cleanDataMessage.profileKey
    );
  }
  if (isMessageEmpty(cleanDataMessage)) {
    window?.log?.warn(`Message ${getEnvelopeId(envelope)} ignored; it was empty`);
    return removeFromCache(envelope);
  }

  if (!convoIdToAddTheMessageTo) {
    window?.log?.error('We cannot handle a message without a conversationId');
    confirm();
    return;
  }

  const msgModel =
    isSyncedMessage || (envelope.senderIdentity && isUsFromCache(envelope.senderIdentity))
      ? createSwarmMessageSentFromUs({
          conversationId: convoIdToAddTheMessageTo,
          messageHash,
          sentAt: sentAtTimestamp,
        })
      : createSwarmMessageSentFromNotUs({
          conversationId: convoIdToAddTheMessageTo,
          messageHash,
          sender: senderConversationModel.id,
          sentAt: sentAtTimestamp,
        });

  await handleSwarmMessage(
    msgModel,
    messageHash,
    sentAtTimestamp,
    cleanDataMessage,
    convoToAddMessageTo,
    () => removeFromCache(envelope)
  );
}

export async function isSwarmMessageDuplicate({
  source,
  sentAt,
}: {
  source: string;
  sentAt: number;
}) {
  try {
    const result = await getMessageBySenderAndSentAt({
      source,
      sentAt,
    });

    return Boolean(result);
  } catch (error) {
    window?.log?.error('isSwarmMessageDuplicate error:', toLogFormat(error));
    return false;
  }
}

// tslint:disable:cyclomatic-complexity max-func-body-length */
async function handleSwarmMessage(
  msgModel: MessageModel,
  messageHash: string,
  sentAt: number,
  rawDataMessage: SignalService.DataMessage,
  convoToAddMessageTo: ConversationModel,
  confirm: () => void
): Promise<void> {
  if (!rawDataMessage || !msgModel) {
    window?.log?.warn('Invalid data passed to handleSwarmMessage.');
    confirm();
    return;
  }

  void convoToAddMessageTo.queueJob(async () => {
    // this call has to be made inside the queueJob!
    const isDuplicate = await isSwarmMessageDuplicate({
      source: msgModel.get('source'),
      sentAt,
    });
    if (isDuplicate) {
      window?.log?.info('Received duplicate message. Dropping it.');
      confirm();
      return;
    }
    await handleMessageJob(
      msgModel,
      convoToAddMessageTo,
      toRegularMessage(rawDataMessage),
      confirm,
      msgModel.get('source'),
      messageHash
    );
  });
}

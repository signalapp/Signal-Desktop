import { SignalService } from '../../../../protobuf';
import { MessageParams } from '../Message';
import { ContentMessage } from '..';
import { v4 as uuid } from 'uuid';
import { PubKey } from '../../../types';
import { getMessageQueue } from '../../..';
import { getConversationController } from '../../../conversations';
import { UserUtils } from '../../../utils';
interface DataExtractionNotificationMessageParams extends MessageParams {
  referencedAttachmentTimestamp: number;
}

export class DataExtractionNotificationMessage extends ContentMessage {
  public readonly referencedAttachmentTimestamp: number;

  constructor(params: DataExtractionNotificationMessageParams) {
    super({ timestamp: params.timestamp, identifier: params.identifier });
    this.referencedAttachmentTimestamp = params.referencedAttachmentTimestamp;
    // this does not make any sense
    if (!this.referencedAttachmentTimestamp) {
      throw new Error('referencedAttachmentTimestamp must be set');
    }
  }

  public contentProto(): SignalService.Content {
    return new SignalService.Content({
      dataExtractionNotification: this.dataExtractionProto(),
    });
  }

  protected dataExtractionProto(): SignalService.DataExtractionNotification {
    const ACTION_ENUM = SignalService.DataExtractionNotification.Type;

    const action = ACTION_ENUM.MEDIA_SAVED; // we cannot know when user screenshots, so it can only be a media saved

    return new SignalService.DataExtractionNotification({
      type: action,
      timestamp: this.referencedAttachmentTimestamp,
    });
  }
}

/**
 * Currently only enabled for private chats
 */
export const sendDataExtractionNotification = async (
  conversationId: string,
  attachmentSender: string,
  referencedAttachmentTimestamp: number
) => {
  const convo = getConversationController().get(conversationId);
  if (!convo || !convo.isPrivate() || convo.isMe() || UserUtils.isUsFromCache(attachmentSender)) {
    window.log.warn('Not sending saving attachment notification for', attachmentSender);
    return;
  }

  const dataExtractionNotificationMessage = new DataExtractionNotificationMessage({
    referencedAttachmentTimestamp,
    identifier: uuid(),
    timestamp: Date.now(),
  });
  const pubkey = PubKey.cast(conversationId);
  window.log.info(
    `Sending DataExtractionNotification to ${conversationId} about attachment: ${referencedAttachmentTimestamp}`
  );

  try {
    await getMessageQueue().sendToPubKey(pubkey, dataExtractionNotificationMessage);
  } catch (e) {
    window.log.warn('failed to send data extraction notification', e);
  }
};

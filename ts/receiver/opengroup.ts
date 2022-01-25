import { noop } from 'lodash';
import { ConversationTypeEnum } from '../models/conversation';
import {
  createPublicMessageSentFromNotUs,
  createPublicMessageSentFromUs,
} from '../models/messageFactory';
import { SignalService } from '../protobuf';
import { OpenGroupRequestCommonType } from '../session/apis/open_group_api/opengroupV2/ApiUtil';
import { OpenGroupMessageV2 } from '../session/apis/open_group_api/opengroupV2/OpenGroupMessageV2';
import { getOpenGroupV2ConversationId } from '../session/apis/open_group_api/utils/OpenGroupUtils';
import { getConversationController } from '../session/conversations';
import { removeMessagePadding } from '../session/crypto/BufferPadding';
import { UserUtils } from '../session/utils';
import { fromBase64ToArray } from '../session/utils/String';
import { isOpengroupMessageDuplicate } from './dataMessage';
import { handleMessageJob } from './queuedJob';

export async function handleOpenGroupV2Message(
  message: OpenGroupMessageV2,
  roomInfos: OpenGroupRequestCommonType
) {
  const { base64EncodedData, sentTimestamp, sender, serverId } = message;
  const { serverUrl, roomId } = roomInfos;
  if (!base64EncodedData || !sentTimestamp || !sender || !serverId) {
    window?.log?.warn('Invalid data passed to handleOpenGroupV2Message.', message);
    return;
  }

  // Note: opengroup messages are not padded
  const dataUint = new Uint8Array(removeMessagePadding(fromBase64ToArray(base64EncodedData)));

  const decoded = SignalService.Content.decode(dataUint);

  const conversationId = getOpenGroupV2ConversationId(serverUrl, roomId);
  if (!conversationId) {
    window?.log?.error('We cannot handle a message without a conversationId');
    return;
  }
  const idataMessage = decoded?.dataMessage;
  if (!idataMessage) {
    window?.log?.error('Invalid decoded opengroup message: no dataMessage');
    return;
  }

  if (!getConversationController().get(conversationId)) {
    window?.log?.error('Received a message for an unknown convo. Skipping');
    return;
  }

  const conversation = await getConversationController().getOrCreateAndWait(
    conversationId,
    ConversationTypeEnum.GROUP
  );

  if (!conversation) {
    window?.log?.warn('Skipping handleJob for unknown convo: ', conversationId);
    return;
  }

  void conversation.queueJob(async () => {
    const isMe = UserUtils.isUsFromCache(sender);

    const commonAttributes = { serverTimestamp: sentTimestamp, serverId, conversationId };
    const attributesForNotUs = { ...commonAttributes, sender };
    // those lines just create an empty message with some basic stuff set.
    // the whole decoding of data is happening in handleMessageJob()
    const msgModel = isMe
      ? createPublicMessageSentFromUs(commonAttributes)
      : createPublicMessageSentFromNotUs(attributesForNotUs);

    // WARNING this is important that the isOpengroupMessageDuplicate is made INSIDE the conversation.queueJob call
    const isDuplicate = await isOpengroupMessageDuplicate(attributesForNotUs);

    if (isDuplicate) {
      window?.log?.info('Received duplicate opengroup message. Dropping it.');
      return;
    }

    await handleMessageJob(
      msgModel,
      conversation,
      decoded?.dataMessage as SignalService.DataMessage,
      noop,
      sender,
      ''
    );
  });
}

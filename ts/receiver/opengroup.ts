import _, { noop } from 'lodash';
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
import { perfEnd, perfStart } from '../session/utils/Performance';
import { fromBase64ToArray } from '../session/utils/String';
import { handleMessageJob, toRegularMessage } from './queuedJob';

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

  // Note: opengroup messages should not be padded
  perfStart(`fromBase64ToArray-${base64EncodedData.length}`);
  const arr = fromBase64ToArray(base64EncodedData);
  perfEnd(`fromBase64ToArray-${base64EncodedData.length}`, 'fromBase64ToArray');

  const dataUint = new Uint8Array(removeMessagePadding(arr));

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

  if (
    !getConversationController()
      .get(conversationId)
      ?.isOpenGroupV2()
  ) {
    window?.log?.error('Received a message for an unknown convo or not an v2. Skipping');
    return;
  }

  const groupConvo = getConversationController().get(conversationId);

  if (!groupConvo) {
    window?.log?.warn('Skipping handleJob for unknown convo: ', conversationId);
    return;
  }

  void groupConvo.queueJob(async () => {
    const isMe = UserUtils.isUsFromCache(sender);

    const commonAttributes = { serverTimestamp: sentTimestamp, serverId, conversationId };
    const attributesForNotUs = { ...commonAttributes, sender };
    // those lines just create an empty message only in-memory with some basic stuff set.
    // the whole decoding of data is happening in handleMessageJob()
    const msgModel = isMe
      ? createPublicMessageSentFromUs(commonAttributes)
      : createPublicMessageSentFromNotUs(attributesForNotUs);

    // Note: deduplication is made in filterDuplicatesFromDbAndIncoming now

    await handleMessageJob(
      msgModel,
      groupConvo,
      toRegularMessage(decoded?.dataMessage as SignalService.DataMessage),
      noop,
      sender,
      ''
    );
  });
}

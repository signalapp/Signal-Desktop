import { AbortSignal } from 'abort-controller';
import { SearchIndex } from 'emoji-mart';
import { Data } from '../../../../data/data';
import { ConversationModel } from '../../../../models/conversation';
import { Action, OpenGroupReactionResponse, Reaction } from '../../../../types/Reaction';
import { Reactions } from '../../../../util/reactions';
import { OnionSending } from '../../../onions/onionSend';
import { ToastUtils, UserUtils } from '../../../utils';
import { OpenGroupPollingUtils } from '../opengroupV2/OpenGroupPollingUtils';
import { getOpenGroupV2ConversationId } from '../utils/OpenGroupUtils';
import { batchGlobalIsSuccess, parseBatchGlobalStatusCode } from './sogsV3BatchPoll';

export const hasReactionSupport = async (
  conversationId: string,
  serverId: number
): Promise<{ supported: boolean; conversation: ConversationModel | null }> => {
  const found = await Data.getMessageByServerId(conversationId, serverId);
  if (!found) {
    window.log.warn(`Open Group Message ${serverId} not found in db`);
    return { supported: false, conversation: null };
  }

  const conversationModel = found?.getConversation();
  if (!conversationModel) {
    window.log.warn(`Conversation for ${serverId} not found in db`);
    return { supported: false, conversation: null };
  }

  if (!conversationModel.hasReactions()) {
    window.log.warn("This open group doesn't have reaction support. Server Message ID", serverId);
    return { supported: false, conversation: null };
  }

  return { supported: true, conversation: conversationModel };
};

export const sendSogsReactionOnionV4 = async (
  serverUrl: string,
  room: string, // this is the roomId
  abortSignal: AbortSignal,
  reaction: Reaction,
  blinded: boolean
): Promise<boolean> => {
  const allValidRoomInfos = OpenGroupPollingUtils.getAllValidRoomInfos(serverUrl, new Set([room]));
  if (!allValidRoomInfos?.length) {
    window?.log?.info('getSendReactionRequest: no valid roominfos got.');
    throw new Error(`Could not find sogs pubkey of url:${serverUrl}`);
  }

  const { supported, conversation } = await hasReactionSupport(
    getOpenGroupV2ConversationId(serverUrl, room),
    reaction.id
  );
  if (!supported) {
    return false;
  }

  if (Reactions.hitRateLimit()) {
    ToastUtils.pushRateLimitHitReactions();

    return false;
  }

  if (!conversation) {
    window.log.warn(`Conversation for ${reaction.id} not found in db`);
    return false;
  }

  // The SOGS endpoint supports any text input so we need to make sure we are sending a valid unicode emoji
  // for an invalid input we use https://emojipedia.org/frame-with-an-x/ as a replacement since it cannot rendered as an emoji but is valid unicode
  // eslint-disable-next-line @typescript-eslint/await-thenable
  const emoji = (await SearchIndex.search(reaction.emoji)) ? reaction.emoji : '🖾';
  const endpoint = `/room/${room}/reaction/${reaction.id}/${emoji}`;
  const method = reaction.action === Action.REACT ? 'PUT' : 'DELETE';
  const serverPubkey = allValidRoomInfos[0].serverPublicKey;

  // Since responses can take a long time we immediately update the sender's UI and if there is a problem it is overwritten by handleOpenGroupMessageReactions later.
  const me = UserUtils.getOurPubKeyStrFromCache();
  await Reactions.handleMessageReaction({
    reaction,
    sender: blinded ? conversation.getUsInThatConversation() || me : me,
    you: true,
    openGroupConversationId: getOpenGroupV2ConversationId(serverUrl, room),
  });

  // reaction endpoint requires an empty dict {}
  const stringifiedBody = null;
  const result = await OnionSending.sendJsonViaOnionV4ToSogs({
    serverUrl,
    endpoint,
    serverPubkey,
    method,
    abortSignal,
    blinded,
    stringifiedBody,
    headers: null,
    throwErrors: true,
  });

  if (!batchGlobalIsSuccess(result)) {
    window?.log?.warn('sendSogsReactionWithOnionV4 Got unknown status code; res:', result);
    throw new Error(
      `sendSogsReactionOnionV4: invalid status code: ${parseBatchGlobalStatusCode(result)}`
    );
  }

  if (!result) {
    throw new Error('Could not putReaction, res is invalid');
  }

  const rawMessage = result.body as OpenGroupReactionResponse;
  if (!rawMessage) {
    throw new Error('putReaction parsing failed');
  }

  const success = Boolean(reaction.action === Action.REACT ? rawMessage.added : rawMessage.removed);

  return success;
};

/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
import { base64_variants, from_base64 } from 'libsodium-wrappers-sumo';
import { compact, isArray, isEmpty, isFinite, isNumber, isObject, pick } from 'lodash';
import { v4 } from 'uuid';

import { OpenGroupData } from '../../../../data/opengroups';
import { ConversationModel } from '../../../../models/conversation';
import { handleOpenGroupV4Message } from '../../../../receiver/opengroup';
import { callUtilsWorker } from '../../../../webworker/workers/browser/util_worker_interface';
import { getConversationController } from '../../../conversations';
import { PubKey } from '../../../types';
import { OpenGroupRequestCommonType } from '../opengroupV2/ApiUtil';
import {
  OpenGroupMessageV4,
  getRoomAndUpdateLastFetchTimestamp,
} from '../opengroupV2/OpenGroupServerPoller';
import { filterDuplicatesFromDbAndIncomingV4 } from '../opengroupV2/SogsFilterDuplicate';
import { getOpenGroupV2ConversationId } from '../utils/OpenGroupUtils';
import {
  addCachedBlindedKey,
  findCachedBlindedMatchOrLookItUp,
  findCachedOurBlindedPubkeyOrLookItUp,
  getCachedNakedKeyFromBlindedNoServerPubkey,
  tryMatchBlindWithStandardKey,
} from './knownBlindedkeys';
import { SogsBlinding } from './sogsBlinding';
import { handleCapabilities } from './sogsCapabilities';
import { BatchSogsReponse, OpenGroupBatchRow, SubRequestMessagesType } from './sogsV3BatchPoll';

import { Data } from '../../../../data/data';
import { ConversationTypeEnum } from '../../../../models/conversationAttributes';
import { createSwarmMessageSentFromUs } from '../../../../models/messageFactory';
import { SignalService } from '../../../../protobuf';
import { innerHandleSwarmContentMessage } from '../../../../receiver/contentMessage';
import { handleOutboxMessageModel } from '../../../../receiver/dataMessage';
import { EnvelopePlus } from '../../../../receiver/types';
import { assertUnreachable } from '../../../../types/sqlSharedTypes';
import { getSodiumRenderer } from '../../../crypto';
import { removeMessagePadding } from '../../../crypto/BufferPadding';
import { DisappearingMessages } from '../../../disappearing_messages';
import { UserUtils } from '../../../utils';
import { sogsRollingDeletions } from './sogsRollingDeletions';
import { processMessagesUsingCache } from './sogsV3MutationCache';

/**
 * Get the convo matching those criteria and make sure it is an opengroup convo, or return null.
 * If you get null, you most likely need to cancel the processing of whatever you are doing
 */
function getSogsConvoOrReturnEarly(serverUrl: string, roomId: string): ConversationModel | null {
  const convoId = getOpenGroupV2ConversationId(serverUrl, roomId);
  if (!convoId) {
    window.log.info(`getSogsConvoOrReturnEarly: convoId not built with ${serverUrl}: ${roomId}`);
    return null;
  }

  const foundConvo = getConversationController().get(convoId);
  if (!foundConvo) {
    window.log.info('getSogsConvoOrReturnEarly: convo not found: ', convoId);
    return null;
  }

  if (!foundConvo.isOpenGroupV2()) {
    window.log.info('getSogsConvoOrReturnEarly: convo not an opengroup: ', convoId);
    return null;
  }

  return foundConvo;
}

/**
 *
 * Handle the pollinfo from the response of a pysogs.
 * Pollinfos contains the subscriberCount (active users), the read, upload and write things we as a user can do.
 */
async function handlePollInfoResponse(
  statusCode: number,
  pollInfoResponseBody: {
    active_users: number;
    read: boolean;
    token: string;
    upload: boolean;
    write: boolean;
    details: {
      admins?: Array<string>;
      image_id: number;
      name?: string;
      moderators?: Array<string>;
      hidden_admins?: Array<string>;
      hidden_moderators?: Array<string>;
    };
  },
  serverUrl: string
) {
  if (statusCode !== 200) {
    window.log.info('handlePollInfoResponse subRequest status code is not 200:', statusCode);
    return;
  }

  if (!isObject(pollInfoResponseBody)) {
    window.log.info('handlePollInfoResponse pollInfoResponseBody is not object');
    return;
  }

  const { active_users, read, upload, write, token, details } = pollInfoResponseBody;

  if (!token || !serverUrl) {
    window.log.info('handlePollInfoResponse token and serverUrl must be set');
    return;
  }
  const stillPolledRooms = OpenGroupData.getV2OpenGroupRoomsByServerUrl(serverUrl);

  if (!stillPolledRooms?.some(r => r.roomId === token && r.serverUrl === serverUrl)) {
    window.log.info('handlePollInfoResponse room is no longer polled: ', token);
    return;
  }

  const foundConvo = getSogsConvoOrReturnEarly(serverUrl, token);
  if (!foundConvo) {
    return; // we already print something in getSogsConvoOrReturnEarly
  }
  await foundConvo.setPollInfo({
    read,
    write,
    upload,
    active_users,
    details: pick(
      details,
      'admins',
      'image_id',
      'moderators',
      'hidden_admins',
      'hidden_moderators',
      'name'
    ),
  });
}

async function filterOutMessagesInvalidSignature(
  messagesFilteredBlindedIds: Array<OpenGroupMessageV4>
) {
  const sentToWorker = messagesFilteredBlindedIds.map(m => {
    return {
      sender: PubKey.cast(m.session_id).key, // we need to keep the prefix if this is a blinded or not pubkey
      base64EncodedSignature: m.signature,
      base64EncodedData: m.data,
    };
  });
  const signatureValidEncodedData = (await callUtilsWorker(
    'verifyAllSignatures',
    sentToWorker
  )) as Array<string>;
  const signaturesValidMessages = compact(
    (signatureValidEncodedData || []).map(validData =>
      messagesFilteredBlindedIds.find(m => m.data === validData)
    )
  );

  return signaturesValidMessages;
}

const handleSogsV3DeletedMessages = async (
  messages: Array<OpenGroupMessageV4>,
  serverUrl: string,
  roomId: string
) => {
  const messagesDeleted = messages.filter(m => Boolean(m.deleted));
  const messagesWithoutDeleted = messages.filter(m => !m.deleted);
  if (!messagesDeleted.length) {
    return messagesWithoutDeleted;
  }

  const allIdsRemoved = messagesDeleted.map(m => m.id);

  try {
    const convoId = getOpenGroupV2ConversationId(serverUrl, roomId);
    const convo = getConversationController().get(convoId);
    const messageIds = await Data.getMessageIdsFromServerIds(allIdsRemoved, convo.id);

    allIdsRemoved.forEach(removedId => {
      sogsRollingDeletions.addMessageDeletedId(convoId, removedId);
    });

    if (messageIds && messageIds.length) {
      await DisappearingMessages.destroyMessagesAndUpdateRedux(
        messageIds.map(messageId => ({
          conversationKey: convoId,
          messageId,
        }))
      );
    }
  } catch (e) {
    window?.log?.warn('handleDeletions failed:', e);
  }
  return messagesWithoutDeleted;
};

const handleMessagesResponseV4 = async (
  messages: Array<OpenGroupMessageV4>,
  serverUrl: string,
  subrequestOption: SubRequestMessagesType
) => {
  if (!subrequestOption || !subrequestOption.messages) {
    window?.log?.error('handleBatchPollResults - missing fields required for message subresponse');
    return;
  }

  try {
    const { roomId } = subrequestOption.messages;

    const stillPolledRooms = OpenGroupData.getV2OpenGroupRoomsByServerUrl(serverUrl);

    if (!stillPolledRooms?.some(r => r.roomId === roomId && r.serverUrl === serverUrl)) {
      window.log.info(`handleMessagesResponseV4: we are no longer polling for ${roomId}: skipping`);
      return;
    }
    const convoId = getOpenGroupV2ConversationId(serverUrl, roomId);

    const roomInfos = await getRoomAndUpdateLastFetchTimestamp(
      convoId,
      messages,
      subrequestOption.messages
    );
    if (!roomInfos || !roomInfos.conversationId) {
      return;
    }

    if (!isArray(messages)) {
      window.log.warn("handleMessagesResponseV4: didn't get an object from batch poll");
      return;
    }

    const messagesWithoutReactionOnlyUpdates = messages.filter(m => {
      const keys = Object.keys(m);
      if (
        keys.length === 3 &&
        keys.includes('id') &&
        keys.includes('seqno') &&
        keys.includes('reactions')
      ) {
        return false;
      }
      return true;
    });

    // Incoming messages from sogvs v3 are returned in descending order from the latest seqno, we need to sort it chronologically
    // Incoming messages for sogs v3 have a timestamp in seconds and not ms.
    // Session works with timestamp in ms, for a lot of things, so first, lets fix this.
    const messagesWithMsTimestamp = messagesWithoutReactionOnlyUpdates
      .sort((a, b) => (a.seqno < b.seqno ? -1 : a.seqno > b.seqno ? 1 : 0))
      .map(m => ({
        ...m,
        posted: m.posted ? Math.floor(m.posted * 1000) : undefined,
      }));

    const messagesWithoutDeleted = await handleSogsV3DeletedMessages(
      messagesWithMsTimestamp,
      serverUrl,
      subrequestOption.messages.roomId
    );

    const messagesWithValidSignature =
      await filterOutMessagesInvalidSignature(messagesWithoutDeleted);
    // we do a first check with blinded ids. Looking to filter out messages we already received from that blinded id.
    const messagesFilteredBlindedIds = await filterDuplicatesFromDbAndIncomingV4(
      messagesWithValidSignature
    );

    const roomDetails: OpenGroupRequestCommonType = pick(roomInfos, 'serverUrl', 'roomId');
    // then we try to find matching real session ids with the blinded ids we have.
    // this is where we override the blindedId with the real one in case we already know that user real sessionId

    const messagesWithResolvedBlindedIdsIfFound = [];
    for (let index = 0; index < messagesFilteredBlindedIds.length; index++) {
      const newMessage = messagesFilteredBlindedIds[index];
      if (newMessage.session_id) {
        const unblindedIdFound = getCachedNakedKeyFromBlindedNoServerPubkey(newMessage.session_id);

        // override the sender in the message itself if we are the sender
        if (unblindedIdFound && UserUtils.isUsFromCache(unblindedIdFound)) {
          newMessage.session_id = unblindedIdFound;
        }
        messagesWithResolvedBlindedIdsIfFound.push(newMessage);
      } else {
        throw Error('session_id is missing so we cannot resolve the blinded id');
      }
    }

    // we use the unverified newMessages seqno and id as last polled because we actually did poll up to those ids.

    const incomingMessageSeqNo = compact(messages.map(n => n.seqno));
    const maxNewMessageSeqNo = Math.max(...incomingMessageSeqNo);

    for (let index = 0; index < messagesWithResolvedBlindedIdsIfFound.length; index++) {
      const msgToHandle = messagesWithResolvedBlindedIdsIfFound[index];
      try {
        await handleOpenGroupV4Message(msgToHandle, roomDetails);
      } catch (e) {
        window?.log?.warn('handleOpenGroupV4Message', e);
      }
    }

    // handling all messages might be slow, so instead refresh the data here before updating the fields we care about
    // and writing it again
    const roomInfosRefreshed = OpenGroupData.getV2OpenGroupRoom(roomInfos.conversationId);
    if (!roomInfosRefreshed || !roomInfosRefreshed.serverUrl || !roomInfosRefreshed.roomId) {
      window.log.warn(`No room for convo ${roomInfos.conversationId}`);
      return;
    }

    // we need to update the timestamp even if we don't have a new MaxMessageServerId
    if (isNumber(maxNewMessageSeqNo) && isFinite(maxNewMessageSeqNo)) {
      roomInfosRefreshed.maxMessageFetchedSeqNo = maxNewMessageSeqNo;
    }
    roomInfosRefreshed.lastFetchTimestamp = Date.now();
    await OpenGroupData.saveV2OpenGroupRoom(roomInfosRefreshed);

    const messagesWithReactions = messages.filter(m => m.reactions !== undefined);

    if (messagesWithReactions.length > 0) {
      const conversationId = getOpenGroupV2ConversationId(serverUrl, roomId);
      const groupConvo = getConversationController().get(conversationId);
      if (groupConvo && groupConvo.isOpenGroupV2()) {
        for (const messageWithReaction of messagesWithReactions) {
          if (isEmpty(messageWithReaction.reactions)) {
            /*
             * When a message is deleted from the server, we get the deleted event as a data: null on the message itself
             * and an update on its reactions.
             * But, because we just deleted that message, we can skip trying to update its reactions: it's not in the DB anymore.
             */
            if (sogsRollingDeletions.hasMessageDeletedId(conversationId, messageWithReaction.id)) {
              continue;
            }
          }
          void groupConvo.queueJob(async () => {
            await processMessagesUsingCache(serverUrl, roomId, messageWithReaction);
          });
        }
      }
    }
  } catch (e) {
    window?.log?.warn('handleNewMessages failed:', e.message);
  }
};

type InboxOutboxResponseObject = {
  id: number; // that specific inbox message id
  sender: string; // blindedPubkey of the sender, the unblinded one is inside message content, encrypted only for our blinded pubkey
  recipient: string; // blindedPubkey of the recipient, used for outbox messages only
  posted_at: number; // timestamp as seconds.microsec
  message: string; // base64 data
};

async function handleInboxOutboxMessages(
  inboxOutboxResponse: Array<InboxOutboxResponseObject>,
  serverUrl: string,
  isOutbox: boolean
) {
  // inbox/outbox messages are blinded so decrypt them using the blinding logic.
  // handle them as a message request after that.
  if (!inboxOutboxResponse || !isArray(inboxOutboxResponse) || inboxOutboxResponse.length === 0) {
    // nothing to do
    return;
  }

  const roomInfos = OpenGroupData.getV2OpenGroupRoomsByServerUrl(serverUrl);
  if (!roomInfos || !roomInfos.length || !roomInfos[0].serverPublicKey) {
    return;
  }
  const ourKeypairBytes = await UserUtils.getUserED25519KeyPairBytes();
  if (!ourKeypairBytes) {
    throw new Error('handleInboxOutboxMessages needs current user keypair');
  }
  const serverPubkey = roomInfos[0].serverPublicKey;

  const sodium = await getSodiumRenderer();
  // make sure to add our blindedpubkey to this server in the cache, if it's not already there
  await findCachedOurBlindedPubkeyOrLookItUp(serverPubkey, sodium);

  for (let index = 0; index < inboxOutboxResponse.length; index++) {
    const inboxOutboxItem = inboxOutboxResponse[index];
    const isOutgoing = isOutbox;
    try {
      const data = from_base64(inboxOutboxItem.message, base64_variants.ORIGINAL);
      const postedAtInMs = Math.floor(inboxOutboxItem.posted_at * 1000);

      const otherBlindedPubkey = isOutbox ? inboxOutboxItem.recipient : inboxOutboxItem.sender;
      const decrypted = await SogsBlinding.decryptWithSessionBlindingProtocol(
        data,
        isOutgoing,
        otherBlindedPubkey,
        serverPubkey,
        ourKeypairBytes
      );

      // decrypt message from result

      const content = new Uint8Array(removeMessagePadding(decrypted.plainText));
      const builtEnvelope: EnvelopePlus = {
        content,
        source: decrypted.senderUnblinded, // this is us for an outbox message, and the sender for an inbox message
        senderIdentity: decrypted.senderUnblinded,
        receivedAt: Date.now(),
        timestamp: postedAtInMs,
        id: v4(),
        type: SignalService.Envelope.Type.SESSION_MESSAGE, // this is not right, but we forward an already decrypted envelope so we don't care
      };

      if (isOutbox) {
        /**
         * Handling outbox messages needs to skip some of the pipeline.
         * It is a kind of synced message, but without the field syncTarget set.
         * We also need to do some custom sogs stuff like setting from which sogs conversationID this message comes from.
         * We will need this to send new message to that user from our second device.
         */
        const recipient = inboxOutboxItem.recipient;
        const contentDecoded = SignalService.Content.decode(content);

        // if we already know this user's unblinded pubkey, store the blinded message we sent to that blinded recipient under
        // the unblinded conversation instead (as we would have merge the blinded one with the other )
        const unblindedIDOrBlinded =
          (await findCachedBlindedMatchOrLookItUp(recipient, serverPubkey, sodium)) || recipient;

        if (contentDecoded.dataMessage) {
          const outboxConversationModel = await getConversationController().getOrCreateAndWait(
            unblindedIDOrBlinded,
            ConversationTypeEnum.PRIVATE
          );
          const serverConversationId =
            OpenGroupData.getV2OpenGroupRoomsByServerUrl(serverUrl)?.[0].conversationId;
          if (!serverConversationId) {
            throw new Error('serverConversationId needs to exist');
          }
          const msgModel = createSwarmMessageSentFromUs({
            conversationId: unblindedIDOrBlinded,
            messageHash: '',
            sentAt: postedAtInMs,
          });
          await outboxConversationModel.setOriginConversationID(serverConversationId);

          await handleOutboxMessageModel(
            msgModel,
            '',
            postedAtInMs,
            contentDecoded.dataMessage as SignalService.DataMessage,
            outboxConversationModel
          );
        }
      } else {
        // this is an inbox message
        const sender = inboxOutboxItem.sender;

        try {
          const match = tryMatchBlindWithStandardKey(
            decrypted.senderUnblinded,
            sender,
            serverPubkey,
            sodium
          );
          if (!match) {
            throw new Error(
              `tryMatchBlindWithStandardKey failed for blinded ${decrypted.senderUnblinded} and ${sender}`
            );
          }
          // that sender just sent us its unblindedId.
          await addCachedBlindedKey({
            blindedId: sender,
            realSessionId: decrypted.senderUnblinded,
            serverPublicKey: serverPubkey,
          });
          await findCachedBlindedMatchOrLookItUp(sender, serverPubkey, sodium);
        } catch (e) {
          window.log.warn('tryMatchBlindWithStandardKey could not veriyfy');
        }

        await innerHandleSwarmContentMessage({
          envelope: builtEnvelope,
          sentAtTimestamp: postedAtInMs,
          plaintext: builtEnvelope.content,
          messageHash: '',
          messageExpirationFromRetrieve: null, // sogs message do not expire
        });
      }
    } catch (e) {
      window.log.warn('handleOutboxMessages failed with:', e.message);
    }
  }

  const rooms = OpenGroupData.getV2OpenGroupRoomsByServerUrl(serverUrl);

  if (!rooms || !rooms.length) {
    window?.log?.error('handleInboxOutboxMessages - Found no rooms with matching server url');
    return;
  }

  const maxInboxOutboxId = inboxOutboxResponse.length
    ? Math.max(...inboxOutboxResponse.map(inboxOutboxItem => inboxOutboxItem.id))
    : undefined || undefined;

  // we should probably extract the inboxId & outboxId fetched to another table, as it is server wide and not room specific
  if (isNumber(maxInboxOutboxId)) {
    const updatedRooms = isOutbox
      ? rooms.map(r => ({ ...r, lastOutboxIdFetched: maxInboxOutboxId }))
      : rooms.map(r => ({ ...r, lastInboxIdFetched: maxInboxOutboxId }));
    // this won't write if no changes are detected
    await OpenGroupData.saveV2OpenGroupRooms(updatedRooms);
  }
}

export const handleBatchPollResults = async (
  serverUrl: string,
  batchPollResults: BatchSogsReponse,
  /** using this as explicit way to ensure order  */
  subrequestOptionsLookup: Array<OpenGroupBatchRow>
) => {
  // @@: Might not need the explicit type field.
  // pro: prevents cases where accidentally two fields for the opt. e.g. capability and message fields truthy.
  // con: the data can be inferred (excluding above case) so it's close to being a redundant field

  // note: handling capabilities first before handling anything else as it affects how things are handled.

  await handleCapabilities(subrequestOptionsLookup, batchPollResults, serverUrl);

  if (batchPollResults && isArray(batchPollResults.body)) {
    /**
     * We run those calls sequentially rather than with a Promise.all call because if we were running those in parallel
     * one call might overwrite the changes to the DB of the other one,
     * Doing those sequentially makes sure that the cache got from the second call is up to date, before writing it.
     */
    for (let index = 0; index < batchPollResults.body.length; index++) {
      const subResponse = batchPollResults.body[index] as any;
      // using subreqOptions as request type lookup,
      // assumes batch subresponse order matches the subrequest order
      const subrequestOption = subrequestOptionsLookup[index];
      const responseType = subrequestOption.type;

      switch (responseType) {
        case 'capabilities':
          // capabilities are handled in handleCapabilities and are skipped here just to avoid the default case below
          break;
        case 'messages':
          // this will also include deleted messages explicitly with `data: null` & edited messages with a new data field & react changes with data not existing
          await handleMessagesResponseV4(subResponse.body, serverUrl, subrequestOption);
          break;
        case 'pollInfo':
          await handlePollInfoResponse(subResponse.code, subResponse.body, serverUrl);

          break;
        case 'inbox':
          await handleInboxOutboxMessages(subResponse.body, serverUrl, false);
          break;
        case 'outbox':
          await handleInboxOutboxMessages(subResponse.body, serverUrl, true);
          break;

        case 'addRemoveModerators':
        case 'deleteMessage':
        case 'banUnbanUser':
        case 'deleteAllPosts':
        case 'updateRoom':
        case 'deleteReaction':
          // we do nothing for all of those, but let's make sure if we ever add something batch polled for, we include it's handling here.
          // the assertUnreachable will fail to compile every time we add a new batch poll endpoint without taking care of it.
          break;
        default:
          assertUnreachable(
            responseType,
            `No matching subrequest response body for type: "${responseType}"`
          );
      }
    }
  }
};

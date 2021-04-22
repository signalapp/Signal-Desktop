import {
  OpenGroupV2Room,
  removeV2OpenGroupRoom,
  saveV2OpenGroupRoom,
} from '../../data/opengroups';
import { ConversationModel, ConversationType } from '../../models/conversation';
import { ConversationController } from '../../session/conversations';
import { allowOnlyOneAtATime } from '../../session/utils/Promise';
import { getOpenGroupV2ConversationId } from '../utils/OpenGroupUtils';
import { openGroupV2GetRoomInfo } from './OpenGroupAPIV2';
import { OpenGroupPollerV2 } from './OpenGroupPollerV2';

/**
 * When we get our configuration from the network, we might get a few times the same open group on two different messages.
 * If we don't do anything, we will join them multiple times.
 * Even if the convo exists only once, the lokiPublicChat API will have several instances polling for the same open group.
 * Which will cause a lot of duplicate messages as they will be merged on a single conversation.
 *
 * To avoid this issue, we allow only a single join of a specific opengroup at a time.
 */
export async function attemptConnectionV2OneAtATime(
  serverUrl: string,
  roomId: string,
  publicKey: string
): Promise<ConversationModel> {
  const oneAtaTimeStr = `oneAtaTimeOpenGroupV2Join:${serverUrl}${roomId}`;
  return allowOnlyOneAtATime(oneAtaTimeStr, async () => {
    return attemptConnectionV2(serverUrl, roomId, publicKey);
  });
}

/**
 *
 * @param serverUrl with protocol, hostname and port included
 */
async function attemptConnectionV2(
  serverUrl: string,
  roomId: string,
  serverPublicKey: string
): Promise<ConversationModel | undefined> {
  const conversationId = getOpenGroupV2ConversationId(serverUrl, roomId);

  if (ConversationController.getInstance().get(conversationId)) {
    // Url incorrect or server not compatible
    throw new Error(window.i18n('publicChatExists'));
  }

  // here, the convo does not exist. Make sure the db is clean too
  await removeV2OpenGroupRoom(conversationId);

  const room: OpenGroupV2Room = {
    serverUrl,
    roomId,
    conversationId,
    serverPublicKey,
  };

  try {
    // save the pubkey to the db right now, the request for room Info
    // will need it and access it from the db
    await saveV2OpenGroupRoom(room);
    const roomInfos = await openGroupV2GetRoomInfo({ roomId, serverUrl });
    if (!roomInfos) {
      throw new Error('Invalid open group roomInfo result');
    }
    const conversation = await ConversationController.getInstance().getOrCreateAndWait(
      conversationId,
      ConversationType.OPEN_GROUP
    );
    room.imageID = roomInfos.imageId || undefined;
    room.roomName = roomInfos.name || undefined;
    await saveV2OpenGroupRoom(room);
    console.warn('openGroupRoom info', roomInfos);

    // mark active so it's not in the contacts list but in the conversation list
    conversation.set({
      active_at: Date.now(),
    });
    await conversation.commit();

    return conversation;
  } catch (e) {
    window.log.warn('Failed to join open group v2', e);
    await removeV2OpenGroupRoom(conversationId);
    throw new Error(window.i18n('connectToServerFail'));
  }
}

export class OpenGroupManagerV2 {
  public static readonly useV2OpenGroups = false;

  private static instance: OpenGroupManagerV2;

  // private pollers: OpenGroupPollerV2 = [];
  private isPolling = false;

  private constructor() {}

  public static getInstance() {
    if (!OpenGroupManagerV2.instance) {
      OpenGroupManagerV2.instance = new OpenGroupManagerV2();
    }
    return OpenGroupManagerV2.instance;
  }

  public startPolling() {
    if (this.isPolling) {
      return;
    }
    this.isPolling = true;
  }
}

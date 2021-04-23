import {
  getAllOpenGroupV2Conversations,
  getAllV2OpenGroupRooms,
  OpenGroupV2Room,
  removeV2OpenGroupRoom,
  saveV2OpenGroupRoom,
} from '../../data/opengroups';
import { ConversationModel, ConversationType } from '../../models/conversation';
import { ConversationController } from '../../session/conversations';
import { allowOnlyOneAtATime } from '../../session/utils/Promise';
import { getOpenGroupV2ConversationId } from '../utils/OpenGroupUtils';
import { OpenGroupRequestCommonType } from './ApiUtil';
import { deleteAuthToken, openGroupV2GetRoomInfo } from './OpenGroupAPIV2';
import { OpenGroupServerPoller } from './OpenGroupServerPoller';

import _ from 'lodash';

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
      ConversationType.GROUP
    );
    room.imageID = roomInfos.imageId || undefined;
    room.roomName = roomInfos.name || undefined;
    await saveV2OpenGroupRoom(room);

    console.warn('openGroupRoom info', roomInfos);

    // mark active so it's not in the contacts list but in the conversation list
    conversation.set({
      active_at: Date.now(),
      name: room.roomName,
      avatarPath: room.roomName,
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

  private readonly pollers: Map<string, OpenGroupServerPoller> = new Map();
  private isPolling = false;

  private constructor() {
    this.startPollingBouncy = this.startPollingBouncy.bind(this);
  }

  public static getInstance() {
    if (!OpenGroupManagerV2.instance) {
      OpenGroupManagerV2.instance = new OpenGroupManagerV2();
    }
    return OpenGroupManagerV2.instance;
  }

  public async startPolling() {
    await allowOnlyOneAtATime('V2ManagerStartPolling', this.startPollingBouncy);
  }

  /**
   * This is not designed to be restarted for now. If you stop polling
   */
  public stopPolling() {
    if (!this.isPolling) {
      return;
    }
    // the stop call calls the abortController, which will effectively cancel the request right away,
    // or drop the result from it.
    this.pollers.forEach(poller => {
      poller.stop();
    });
    this.pollers.clear();

    this.isPolling = false;
  }

  public addRoomToPolledRooms(roomInfos: OpenGroupRequestCommonType) {
    const poller = this.pollers.get(roomInfos.serverUrl);
    if (!poller) {
      this.pollers.set(roomInfos.serverUrl, new OpenGroupServerPoller([roomInfos]));
      return;
    }
    // this won't do a thing if the room is already polled for
    poller.addRoomToPoll(roomInfos);
  }

  public removeRoomFromPolledRooms(roomInfos: OpenGroupRequestCommonType) {
    const poller = this.pollers.get(roomInfos.serverUrl);
    if (!poller) {
      console.warn('No such poller');
      return;
    }
    // this won't do a thing if the room is already polled for
    poller.removeRoomFromPoll(roomInfos);
    if (poller.getPolledRoomsCount() === 0) {
      this.pollers.delete(roomInfos.serverUrl);
      // this poller is not needed anymore, kill it
      poller.stop();
    }
  }

  /**
   * This function is private because we want to make sure it only runs once at a time.
   */
  private async startPollingBouncy() {
    if (this.isPolling) {
      return;
    }
    const allConvos = await getAllOpenGroupV2Conversations();
    let allRoomInfos = await getAllV2OpenGroupRooms();

    // this is time for some cleanup!
    // We consider the conversations are our source-of-truth,
    // so if there is a roomInfo without an associated convo, we remove it
    if (allRoomInfos) {
      await Promise.all(
        [...allRoomInfos.values()].map(async infos => {
          try {
            const roomConvoId = getOpenGroupV2ConversationId(infos.serverUrl, infos.roomId);
            if (!allConvos.get(roomConvoId)) {
              // leave the group on the remote server
              // this request doesn't throw
              await deleteAuthToken(_.pick(infos, 'serverUrl', 'roomId'));
              // remove the roomInfos locally for this open group room
              await removeV2OpenGroupRoom(roomConvoId);
              // no need to remove it from the ConversationController, the convo is already not there
            }
          } catch (e) {
            window.log.warn('cleanup roomInfos error', e);
          }
        })
      );
    }
    // refresh our roomInfos list
    allRoomInfos = await getAllV2OpenGroupRooms();
    if (allRoomInfos) {
      allRoomInfos.forEach(infos => {
        this.addRoomToPolledRooms(infos);
      });
    }

    this.isPolling = true;
  }
}

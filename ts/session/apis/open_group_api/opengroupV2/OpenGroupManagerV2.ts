/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */

import { clone, groupBy, isEqual, uniqBy } from 'lodash';
import autoBind from 'auto-bind';

import { OpenGroupData, OpenGroupV2Room } from '../../../../data/opengroups';
import { ConversationModel } from '../../../../models/conversation';
import { getConversationController } from '../../../conversations';
import { allowOnlyOneAtATime } from '../../../utils/Promise';
import {
  getAllValidOpenGroupV2ConversationRoomInfos,
  getOpenGroupV2ConversationId,
} from '../utils/OpenGroupUtils';
import {
  OpenGroupRequestCommonType,
  ourSogsDomainName,
  ourSogsLegacyIp,
  ourSogsUrl,
} from './ApiUtil';
import { OpenGroupServerPoller } from './OpenGroupServerPoller';

import {
  CONVERSATION_PRIORITIES,
  ConversationTypeEnum,
} from '../../../../models/conversationAttributes';
import { SessionUtilUserGroups } from '../../../utils/libsession/libsession_utils_user_groups';
import { openGroupV2GetRoomInfoViaOnionV4 } from '../sogsv3/sogsV3RoomInfos';
import { UserGroupsWrapperActions } from '../../../../webworker/workers/browser/libsession_worker_interface';

let instance: OpenGroupManagerV2 | undefined;

export const getOpenGroupManager = () => {
  if (!instance) {
    instance = new OpenGroupManagerV2();
  }
  return instance;
};

export class OpenGroupManagerV2 {
  public static readonly useV2OpenGroups = false;

  /**
   * The map of opengroup pollers, by serverUrl.
   * A single poller polls for every room on the specified serverUrl
   */
  private readonly pollers: Map<string, OpenGroupServerPoller> = new Map();
  private isPolling = false;

  constructor() {
    autoBind(this);
  }

  /**
   * When we get our configuration from the network, we might get a few times the same open group on two different messages.
   * If we don't do anything, we will join them multiple times.
   * Which will cause a lot of duplicate messages as they will be merged on a single conversation.
   *
   * To avoid this issue, we allow only a single join of a specific opengroup at a time.
   */
  public async attemptConnectionV2OneAtATime(
    serverUrl: string,
    roomId: string,
    publicKey: string
  ): Promise<ConversationModel | undefined> {
    // make sure to use the https version of our official sogs
    const overridenUrl =
      (serverUrl.includes(`://${ourSogsDomainName}`) && !serverUrl.startsWith('https')) ||
      serverUrl.includes(`://${ourSogsLegacyIp}`)
        ? ourSogsUrl
        : serverUrl;

    const oneAtaTimeStr = `oneAtaTimeOpenGroupV2Join:${overridenUrl}${roomId}`;
    return allowOnlyOneAtATime(oneAtaTimeStr, async () => {
      return this.attemptConnectionV2(overridenUrl, roomId, publicKey);
    });
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

  public addRoomToPolledRooms(roomInfos: Array<OpenGroupRequestCommonType>) {
    const grouped = groupBy(roomInfos, r => r.serverUrl);
    const groupedArray = Object.values(grouped);

    for (const groupedRooms of groupedArray) {
      const groupedRoomsServerUrl = groupedRooms[0].serverUrl;
      const poller = this.pollers.get(groupedRoomsServerUrl);
      if (!poller) {
        const uniqGroupedRooms = uniqBy(groupedRooms, r => r.roomId);

        this.pollers.set(groupedRoomsServerUrl, new OpenGroupServerPoller(uniqGroupedRooms));
      } else {
        // this won't do a thing if the room is already polled for
        groupedRooms.forEach(poller.addRoomToPoll);
      }
    }
  }

  public removeRoomFromPolledRooms(roomInfos: OpenGroupRequestCommonType) {
    const poller = this.pollers.get(roomInfos.serverUrl);
    if (!poller) {
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
    const allRoomInfos = await getAllValidOpenGroupV2ConversationRoomInfos();
    if (allRoomInfos?.size) {
      this.addRoomToPolledRooms([...allRoomInfos.values()]);
    }

    this.isPolling = true;
  }

  /**
   *
   * @param serverUrl with protocol, hostname and port included
   */
  private async attemptConnectionV2(
    serverUrl: string,
    roomId: string,
    serverPublicKey: string
  ): Promise<ConversationModel | undefined> {
    let conversationId = getOpenGroupV2ConversationId(serverUrl, roomId);

    if (getConversationController().get(conversationId)) {
      // Url incorrect or server not compatible
      throw new Error(window.i18n('publicChatExists'));
    }

    try {
      const fullUrl = await UserGroupsWrapperActions.buildFullUrlFromDetails(
        serverUrl,
        roomId,
        serverPublicKey
      );
      // here, the convo does not exist. Make sure the db & wrappers are clean too
      await OpenGroupData.removeV2OpenGroupRoom(conversationId);
      try {
        await SessionUtilUserGroups.removeCommunityFromWrapper(conversationId, fullUrl);
      } catch (e) {
        window.log.warn('failed to removeCommunityFromWrapper', conversationId);
      }

      const room: OpenGroupV2Room = {
        serverUrl,
        roomId,
        conversationId,
        serverPublicKey,
      };
      const updatedRoom = clone(room);
      // save the pubkey to the db right now, the request for room Info
      // will need it and access it from the db
      await OpenGroupData.saveV2OpenGroupRoom(room);

      // TODOLATER make the requests made here retry a few times (can fail when trying to join a group too soon after a restart)
      const roomInfos = await openGroupV2GetRoomInfoViaOnionV4({
        serverPubkey: serverPublicKey,
        serverUrl,
        roomId,
      });

      if (!roomInfos || !roomInfos.id) {
        throw new Error('Invalid open group roomInfo result');
      }
      updatedRoom.roomId = roomInfos.id;
      conversationId = getOpenGroupV2ConversationId(serverUrl, roomInfos.id);
      updatedRoom.conversationId = conversationId;
      if (!isEqual(room, updatedRoom)) {
        await OpenGroupData.removeV2OpenGroupRoom(conversationId);
        await OpenGroupData.saveV2OpenGroupRoom(updatedRoom);
      }

      const conversation = await getConversationController().getOrCreateAndWait(
        conversationId,
        ConversationTypeEnum.GROUP
      );
      updatedRoom.imageID = roomInfos.imageId || undefined;
      updatedRoom.roomName = roomInfos.name || undefined;
      updatedRoom.capabilities = roomInfos.capabilities;
      await OpenGroupData.saveV2OpenGroupRoom(updatedRoom);

      // mark active so it's not in the contacts list but in the conversation list
      // mark isApproved as this is a public chat
      conversation.set({
        active_at: Date.now(),
        displayNameInProfile: updatedRoom.roomName,
        isApproved: true,
        didApproveMe: true,
        priority: CONVERSATION_PRIORITIES.default,
        isTrustedForAttachmentDownload: true, // we always trust attachments when sent to an opengroup
      });
      await conversation.commit();

      // start polling this room
      this.addRoomToPolledRooms([updatedRoom]);

      return conversation;
    } catch (e) {
      window?.log?.warn('Failed to join open group v2', e.message);
      await OpenGroupData.removeV2OpenGroupRoom(conversationId);
      // throw new Error(window.i18n('connectToServerFail'));
      return undefined;
    }
  }
}

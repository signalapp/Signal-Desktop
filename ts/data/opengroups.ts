import { ConversationCollection } from '../models/conversation';
import { OpenGroupRequestCommonType } from '../session/apis/open_group_api/opengroupV2/ApiUtil';
import { isOpenGroupV2 } from '../session/apis/open_group_api/utils/OpenGroupUtils';
import { channels } from './channels';

export type OpenGroupV2Room = {
  serverUrl: string;
  serverPublicKey: string; // this is actually shared for all this server's room
  roomId: string;
  roomName?: string; // a user displayed name
  imageID?: string; // the url to the group's image
  conversationId?: string; // the linked ConversationModel.id
  lastMessageFetchedServerID?: number;
  /**
   * This value represents the rowId of the last message deleted. Not the id of the last message ID
   */
  lastMessageDeletedServerID?: number;
  /**
   * This value is set with the current timestamp whenever we get new messages.
   */
  lastFetchTimestamp?: number;
  token?: string; // currently, the token is on a per room basis
};

export async function getAllV2OpenGroupRooms(): Promise<Map<string, OpenGroupV2Room> | undefined> {
  const opengroupsv2Rooms = (await channels.getAllV2OpenGroupRooms()) as Array<OpenGroupV2Room>;

  if (!opengroupsv2Rooms) {
    return undefined;
  }

  const results = new Map<string, OpenGroupV2Room>();

  opengroupsv2Rooms.forEach(o => {
    if (o.conversationId) {
      results.set(o.conversationId, o);
    }
  });

  return results;
}

export async function getV2OpenGroupRoom(
  conversationId: string
): Promise<OpenGroupV2Room | undefined> {
  if (!isOpenGroupV2(conversationId)) {
    throw new Error(`getV2OpenGroupRoom: this is not a valid v2 id: ${conversationId}`);
  }
  const opengroupv2Rooms = await channels.getV2OpenGroupRoom(conversationId);

  if (!opengroupv2Rooms) {
    return undefined;
  }

  return opengroupv2Rooms;
}

export async function getV2OpenGroupRoomByRoomId(
  roomInfos: OpenGroupRequestCommonType
): Promise<OpenGroupV2Room | undefined> {
  const room = await channels.getV2OpenGroupRoomByRoomId(roomInfos.serverUrl, roomInfos.roomId);

  if (!room) {
    return undefined;
  }

  return room;
}

export async function saveV2OpenGroupRoom(opengroupsv2Room: OpenGroupV2Room): Promise<void> {
  if (
    !opengroupsv2Room.conversationId ||
    !opengroupsv2Room.roomId ||
    !opengroupsv2Room.serverUrl ||
    !opengroupsv2Room.serverPublicKey
  ) {
    throw new Error('Cannot save v2 room, invalid data');
  }

  await channels.saveV2OpenGroupRoom(opengroupsv2Room);
}

export async function removeV2OpenGroupRoom(conversationId: string): Promise<void> {
  await channels.removeV2OpenGroupRoom(conversationId);
}

export async function getAllOpenGroupV2Conversations(): Promise<ConversationCollection> {
  const conversations = await channels.getAllOpenGroupV2Conversations();

  const collection = new ConversationCollection();
  collection.add(conversations);
  return collection;
}

import { cloneDeep, isNumber, uniq } from 'lodash';
import { channels } from './channels';
import { OpenGroupRequestCommonType, OpenGroupV2Room } from './types';
import { isOpenGroupV2 } from '../session/apis/open_group_api/utils/OpenGroupUtils';

export type OpenGroupV2RoomWithImageID = {
  serverUrl: string;

  /** this is actually shared for all this server's room */
  serverPublicKey: string;
  roomId: string;

  /** the fileId to the group room's image */
  imageID?: string;
};

export const OpenGroupData = {
  getAllV2OpenGroupRoomsMap,
  opengroupRoomsLoad,
  getV2OpenGroupRoom,
  getV2OpenGroupRoomsByServerUrl,
  saveV2OpenGroupRoom,
  saveV2OpenGroupRooms,
  getV2OpenGroupRoomByRoomId,
  removeV2OpenGroupRoom,
  getAllOpengroupsServerPubkeys,
  getAllV2OpenGroupRooms,
};

/**
 *
 * @returns a map containing as key the conversationId of the opengroup room and as value the OpenGroupV2Room details
 */
function getAllV2OpenGroupRoomsMap(): Map<string, OpenGroupV2Room> | undefined {
  const results = new Map<string, OpenGroupV2Room>();

  throwIfNotLoaded().forEach(o => {
    if (o.conversationId) {
      results.set(o.conversationId, cloneDeep(o));
    }
  });

  return results;
}

// this is just to make testing and stubbing easier
async function getAllV2OpenGroupRooms(): Promise<Array<OpenGroupV2Room> | undefined> {
  return channels.getAllV2OpenGroupRooms();
}

// avoid doing fetches and write too often from the db by using a cache on the renderer side.
let cachedRooms: Array<OpenGroupV2Room> | null = null;

async function opengroupRoomsLoad() {
  if (cachedRooms !== null) {
    return;
  }
  const loadedFromDB = await OpenGroupData.getAllV2OpenGroupRooms();

  if (loadedFromDB) {
    cachedRooms = [];
    loadedFromDB.forEach(r => {
      try {
        cachedRooms?.push(r as any);
      } catch (e) {
        window.log.warn(e.message);
      }
    });
    return;
  }
  cachedRooms = [];
}

function throwIfNotLoaded() {
  if (cachedRooms === null) {
    throw new Error('opengroupRoomsLoad must be called first');
  }
  return cachedRooms;
}
function getV2OpenGroupRoom(conversationId: string): OpenGroupV2Room | undefined {
  if (!isOpenGroupV2(conversationId)) {
    throw new Error(`getV2OpenGroupRoom: this is not a valid v2 id: ${conversationId}`);
  }

  const found = throwIfNotLoaded().find(m => m.conversationId === conversationId);
  return (found && cloneDeep(found)) || undefined;
}
function getV2OpenGroupRoomsByServerUrl(serverUrl: string): Array<OpenGroupV2Room> | undefined {
  const found = throwIfNotLoaded().filter(m => m.serverUrl === serverUrl);

  return (found && cloneDeep(found)) || undefined;
}

function getV2OpenGroupRoomByRoomId(
  roomInfos: OpenGroupRequestCommonType
): OpenGroupV2Room | undefined {
  const found = throwIfNotLoaded().find(
    m => m.roomId === roomInfos.roomId && m.serverUrl === roomInfos.serverUrl
  );

  return (found && cloneDeep(found)) || undefined;
}
async function saveV2OpenGroupRooms(rooms: Array<OpenGroupV2Room>): Promise<void> {
  await Promise.all(rooms.map(saveV2OpenGroupRoom));
}

async function saveV2OpenGroupRoom(room: OpenGroupV2Room): Promise<void> {
  if (!room.conversationId || !room.roomId || !room.serverUrl || !room.serverPublicKey) {
    throw new Error('Cannot save v2 room, invalid data');
  }

  const found =
    (room.conversationId &&
      throwIfNotLoaded().find(m => m.conversationId === room.conversationId)) ||
    undefined;

  if (!found) {
    await channels.saveV2OpenGroupRoom(room);
    throwIfNotLoaded().push(cloneDeep(room));
    return;
  }

  // because isEqual is funky with pointer being changed, we have to do this for now
  if (JSON.stringify(room) !== JSON.stringify(found)) {
    await channels.saveV2OpenGroupRoom(room);
    const foundIndex =
      room.conversationId &&
      throwIfNotLoaded().findIndex(m => m.conversationId === room.conversationId);
    if (isNumber(foundIndex) && foundIndex > -1) {
      throwIfNotLoaded()[foundIndex] = cloneDeep(room);
    }
  }
}

async function removeV2OpenGroupRoom(conversationId: string): Promise<void> {
  await channels.removeV2OpenGroupRoom(conversationId);
  const foundIndex =
    conversationId && throwIfNotLoaded().findIndex(m => m.conversationId === conversationId);
  if (isNumber(foundIndex) && foundIndex > -1) {
    throwIfNotLoaded().splice(foundIndex, 1);
  }
}

function getAllOpengroupsServerPubkeys(): Array<string> {
  return uniq(throwIfNotLoaded().map(room => room.serverPublicKey)) || [];
}

import _, { compact, flatten, isString } from 'lodash';
import { allowOnlyOneAtATime } from '../../../utils/Promise';
import {
  updateDefaultRooms,
  updateDefaultRoomsInProgress,
} from '../../../../state/ducks/defaultRooms';
import { getCompleteUrlFromRoom } from '../utils/OpenGroupUtils';
import { parseOpenGroupV2 } from './JoinOpenGroupV2';
import { getAllRoomInfos } from '../sogsv3/sogsV3RoomInfos';
import { OpenGroupData } from '../../../../data/opengroups';
import { getConversationController } from '../../../conversations';

export type OpenGroupRequestCommonType = {
  serverUrl: string;
  roomId: string;
};

export type OpenGroupCapabilityRequest = {
  server: string;
  endpoint: string;
  serverPubKey: string;
  headers: Record<string, string | number>;
  method: string;
  useV4: boolean;
};

export type OpenGroupV2Info = {
  id: string;
  name: string;
  imageId?: string;
  capabilities?: Array<string>;
};

export type OpenGroupV2InfoJoinable = OpenGroupV2Info & {
  completeUrl: string;
  base64Data?: string;
};

// tslint:disable: no-http-string

const legacyDefaultServerIP = '116.203.70.33';
export const defaultServer = 'https://open.getsession.org';
const defaultServerHost = new window.URL(defaultServer).host;

/**
 * This function returns true if the server url given matches any of the sogs run by Session.
 * It basically compares the hostname of the given server, to the hostname or the ip address of the session run sogs.
 *
 * Note: Exported for test only
 */
export function isSessionRunOpenGroup(server: string): boolean {
  if (!server || !isString(server)) {
    return false;
  }

  const lowerCased = server.toLowerCase();
  let serverHost: string | undefined;
  try {
    const lowerCasedUrl = new window.URL(lowerCased);
    serverHost = lowerCasedUrl.hostname; // hostname because we don't want the port to be part of this
    if (!serverHost) {
      throw new Error('Could not parse URL from serverURL');
    }
  } catch (e) {
    // plain ip are not recognized are url, but we want to allow them
    serverHost = lowerCased;
  }

  const options = [legacyDefaultServerIP, defaultServerHost];
  return options.includes(serverHost);
}

/**
 * Returns true if we have not joined any rooms matching this roomID and any combination of serverURL.
 *
 * This will look for http, https, and no prefix string serverURL, but also takes care of checking hostname/ip for session run sogs
 */
export function hasExistingOpenGroup(server: string, roomId: string) {
  if (!server || !isString(server)) {
    return false;
  }

  const serverNotLowerCased = server;
  const serverLowerCase = serverNotLowerCased.toLowerCase();

  let serverUrl: URL | undefined;
  try {
    serverUrl = new window.URL(serverLowerCase);
    if (!serverUrl) {
      throw new Error('failed to parse url in hasExistingOpenGroup');
    }
  } catch (e) {
    try {
      serverUrl = new window.URL(`http://${serverLowerCase}`);
    } catch (e) {
      window.log.error(`hasExistingOpenGroup with ${serverNotLowerCased} with ${e.message}`);

      return false;
    }
  }

  // make sure that serverUrl.host has the port set in it

  const serverOptions: Set<string> = new Set([
    serverLowerCase,
    `${serverUrl.host}`,
    `http://${serverUrl.host}`,
    `https://${serverUrl.host}`,
  ]);

  // If the server is run by Session then include all configurations in case one of the alternate configurations is used
  if (isSessionRunOpenGroup(serverLowerCase)) {
    serverOptions.add(defaultServerHost);
    serverOptions.add(`http://${defaultServerHost}`);
    serverOptions.add(`https://${defaultServerHost}`);
    serverOptions.add(legacyDefaultServerIP);
    serverOptions.add(`http://${legacyDefaultServerIP}`);
    serverOptions.add(`https://${legacyDefaultServerIP}`);
  }

  const rooms = flatten(
    compact([...serverOptions].map(OpenGroupData.getV2OpenGroupRoomsByServerUrl))
  );

  if (rooms.length === 0) {
    // we didn't find any room matching any of that url. We cannot have join that serverURL yet then

    return false;
  }

  // We did find some rooms by serverURL but now we need to make sure none of those matches the room we are about to join.
  const matchingRoom = rooms.find(r => r.roomId === roomId);

  return Boolean(
    matchingRoom &&
      matchingRoom.conversationId &&
      getConversationController().get(matchingRoom.conversationId)
  );
}

const defaultServerPublicKey = 'a03c383cf63c3c4efe67acc52112a6dd734b3a946b9545f488aaa93da7991238';
const defaultRoom = `${defaultServer}/main?public_key=${defaultServerPublicKey}`;

const loadDefaultRoomsSingle = () =>
  allowOnlyOneAtATime('loadDefaultRoomsSingle', async () => {
    const roomInfos = parseOpenGroupV2(defaultRoom);
    if (roomInfos) {
      try {
        const roomsGot = await getAllRoomInfos(roomInfos);

        if (!roomsGot) {
          return [];
        }

        return roomsGot.map(room => {
          return {
            ...room,
            completeUrl: getCompleteUrlFromRoom({
              serverUrl: roomInfos.serverUrl,
              serverPublicKey: roomInfos.serverPublicKey,
              roomId: room.id,
            }),
          };
        });
      } catch (e) {
        window?.log?.warn('loadDefaultRoomloadDefaultRoomssIfNeeded failed', e);
      }
      return [];
    }
    return [];
  });

/**
 * Load to the cache all the details of the room of the default opengroupv2 server
 * This call will only run once at a time.
 */
export const loadDefaultRooms = async () => {
  window.inboxStore?.dispatch(updateDefaultRoomsInProgress(true));
  const allRooms: Array<OpenGroupV2InfoJoinable> = await loadDefaultRoomsSingle();
  window.inboxStore?.dispatch(updateDefaultRoomsInProgress(false));

  if (allRooms !== undefined) {
    window.inboxStore?.dispatch(updateDefaultRooms(allRooms));
  }
};

import { OpenGroupV2Room } from '../../../../data/opengroups';
import { ConversationModel } from '../../../../models/conversation';
import { getConversationController } from '../../../conversations';
import { PromiseUtils, ToastUtils } from '../../../utils';

import { forceSyncConfigurationNowIfNeeded } from '../../../utils/sync/syncUtils';
import {
  getOpenGroupV2ConversationId,
  openGroupV2CompleteURLRegex,
  prefixify,
  publicKeyParam,
} from '../utils/OpenGroupUtils';
import { hasExistingOpenGroup } from './ApiUtil';
import { getOpenGroupManager } from './OpenGroupManagerV2';

// Inputs that should work:
// https://sessionopengroup.co/main?public_key=658d29b91892a2389505596b135e76a53db6e11d613a51dbd3d0816adffb231c
// http://sessionopengroup.co/main?public_key=658d29b91892a2389505596b135e76a53db6e11d613a51dbd3d0816adffb231c
// sessionopengroup.co/main?public_key=658d29b91892a2389505596b135e76a53db6e11d613a51dbd3d0816adffb231c (does NOT go to HTTPS)
// https://143.198.213.225:443/main?public_key=658d29b91892a2389505596b135e76a53db6e11d613a51dbd3d0816adffb231c
// 143.198.213.255:80/main?public_key=658d29b91892a2389505596b135e76a53db6e11d613a51dbd3d0816adffb231c

export function parseOpenGroupV2(urlWithPubkey: string): OpenGroupV2Room | undefined {
  const trimmed = urlWithPubkey.trim();
  try {
    if (!openGroupV2CompleteURLRegex.test(trimmed)) {
      throw new Error('regex fail');
    }

    // prefix the URL if it does not have a prefix
    const prefixedUrl = prefixify(trimmed);
    // new URL fails if the protocol is not explicit
    const url = new URL(prefixedUrl);

    // the port (if any is set) is already in the url.host so no need to += url.port
    const serverUrl = `${url.protocol}//${url.host}`;

    const room: OpenGroupV2Room = {
      serverUrl,
      roomId: url.pathname.slice(1), // remove first '/'
      serverPublicKey: url.search.slice(publicKeyParam.length + 1), // remove the '?' and the 'public_key=' header
    };
    return room;
  } catch (e) {
    window?.log?.error('Invalid Opengroup v2 join URL:', trimmed, e);
  }
  return undefined;
}

/**
 * Join an open group using the v2 logic.
 *
 * If you only have an string with all details in it, use parseOpenGroupV2() to extract and check the URL is valid
 *
 * @param server The server URL to join, defaults to https if protocol is not set
 * @param room The room id to join
 * @param publicKey The server publicKey. It comes from the joining link. (or is already here for the default open group server)
 */
async function joinOpenGroupV2(
  room: OpenGroupV2Room,
  fromConfigMessage: boolean
): Promise<ConversationModel | undefined> {
  if (!room.serverUrl || !room.roomId || room.roomId.length < 1 || !room.serverPublicKey) {
    return undefined;
  }

  const serverUrl = room.serverUrl;
  const roomId = room.roomId;
  const publicKey = room.serverPublicKey.toLowerCase();
  const prefixedServer = prefixify(serverUrl);

  const alreadyExist = hasExistingOpenGroup(serverUrl, roomId);
  const conversationId = getOpenGroupV2ConversationId(serverUrl, roomId);
  const existingConvo = getConversationController().get(conversationId);

  if (alreadyExist) {
    window?.log?.warn('Skipping join opengroupv2: already exists');
    return undefined;
  }
  if (existingConvo) {
    // we already have a convo associated with it. Remove everything related to it so we start fresh
    window?.log?.warn('leaving before rejoining open group v2 room', conversationId);

    await getConversationController().deleteCommunity(conversationId, {
      fromSyncMessage: true,
    });
  }

  // Try to connect to server
  try {
    const conversation = await PromiseUtils.timeout(
      getOpenGroupManager().attemptConnectionV2OneAtATime(prefixedServer, roomId, publicKey),
      20000
    );

    if (!conversation) {
      window?.log?.warn('Failed to join open group v2');
      throw new Error(window.i18n('connectToServerFail'));
    }

    // here we managed to connect to the group.
    // if this is not a Sync Message, we should trigger one
    if (!fromConfigMessage) {
      await forceSyncConfigurationNowIfNeeded();
    }
    return conversation;
  } catch (e) {
    window?.log?.error('Could not join open group v2', e.message);
    throw e;
  }
}

export type JoinSogsRoomUICallbackArgs = {
  loadingState: 'started' | 'finished' | 'failed';
  conversationKey: string | null;
};

/**
 * This function does not throw
 * This function can be used to join an opengroupv2 server, from a user initiated click or from a syncMessage.
 * If the user made the request, the UI callback needs to be set.
 * the callback will be called on loading events (start and stop joining). Also, this callback being set defines if we will trigger a sync message or not.
 *
 * Basically,
 *  - user invitation click => uicallback set
 *  - user join manually from the join open group field => uicallback set
 *  - joining from a sync message => no uicallback
 *
 *
 * return true if the room did not exist before, and we join it correctly
 */
export async function joinOpenGroupV2WithUIEvents(
  completeUrl: string,
  showToasts: boolean,
  fromConfigMessage: boolean,
  uiCallback?: (args: JoinSogsRoomUICallbackArgs) => void
): Promise<boolean> {
  try {
    const parsedRoom = parseOpenGroupV2(completeUrl);
    if (!parsedRoom) {
      if (showToasts) {
        ToastUtils.pushToastError('connectToServer', window.i18n('invalidOpenGroupUrl'));
      }
      return false;
    }
    const alreadyExist = hasExistingOpenGroup(parsedRoom.serverUrl, parsedRoom.roomId);
    const conversationID = getOpenGroupV2ConversationId(parsedRoom.serverUrl, parsedRoom.roomId);
    if (alreadyExist || getConversationController().get(conversationID)) {
      const existingConvo = getConversationController().get(conversationID);
      await existingConvo.setDidApproveMe(true, false);
      await existingConvo.setIsApproved(true, false);
      await existingConvo.commit();
      if (showToasts) {
        ToastUtils.pushToastError('publicChatExists', window.i18n('publicChatExists'));
      }
      return false;
    }
    if (showToasts) {
      ToastUtils.pushToastInfo('connectingToServer', window.i18n('connectingToServer'));
    }

    uiCallback?.({ loadingState: 'started', conversationKey: conversationID });

    const convoCreated = await joinOpenGroupV2(parsedRoom, fromConfigMessage);

    if (convoCreated) {
      if (showToasts) {
        ToastUtils.pushToastSuccess(
          'connectToServerSuccess',
          window.i18n('connectToServerSuccess')
        );
      }
      uiCallback?.({ loadingState: 'finished', conversationKey: convoCreated?.id });

      return true;
    }
    if (showToasts) {
      ToastUtils.pushToastError('connectToServerFail', window.i18n('connectToServerFail'));
    }

    uiCallback?.({ loadingState: 'failed', conversationKey: conversationID });
  } catch (error) {
    window?.log?.warn('got error while joining open group:', error.message);
    if (showToasts) {
      ToastUtils.pushToastError('connectToServerFail', window.i18n('connectToServerFail'));
    }
    uiCallback?.({ loadingState: 'failed', conversationKey: null });
  }
  return false;
}

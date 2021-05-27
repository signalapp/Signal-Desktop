import {
  getCompleteUrlFromRoom,
  openGroupPrefixRegex,
  openGroupV2ConversationIdRegex,
} from '../opengroup/utils/OpenGroupUtils';
import { getV2OpenGroupRoom } from '../data/opengroups';
import { ToastUtils } from '../session/utils';
import { ConversationModel } from '../models/conversation';
import { MessageModel } from '../models/message';
import { ApiV2 } from '../opengroup/opengroupV2';

import _ from 'lodash';

export const getCompleteUrlForV2ConvoId = async (convoId: string) => {
  if (convoId.match(openGroupV2ConversationIdRegex)) {
    // this is a v2 group, just build the url
    const roomInfos = await getV2OpenGroupRoom(convoId);
    if (roomInfos) {
      const fullUrl = getCompleteUrlFromRoom(roomInfos);

      return fullUrl;
    }
  }
  return undefined;
};

export async function copyPublicKey(convoId: string) {
  if (convoId.match(openGroupPrefixRegex)) {
    // open group v1 or v2
    if (convoId.match(openGroupV2ConversationIdRegex)) {
      // this is a v2 group, just build the url
      const completeUrl = await getCompleteUrlForV2ConvoId(convoId);
      if (completeUrl) {
        window.clipboard.writeText(completeUrl);

        ToastUtils.pushCopiedToClipBoard();
        return;
      }
      window?.log?.warn('copy to pubkey no roomInfo');
      return;
    }

    // this is a v1
    const atIndex = convoId.indexOf('@');
    const openGroupUrl = convoId.substr(atIndex + 1);
    window.clipboard.writeText(openGroupUrl);

    ToastUtils.pushCopiedToClipBoard();
    return;
  }
  window.clipboard.writeText(convoId);

  ToastUtils.pushCopiedToClipBoard();
}

export async function deleteOpenGroupMessages(
  messages: Array<MessageModel>,
  convo: ConversationModel
): Promise<Array<MessageModel>> {
  if (!convo.isPublic()) {
    throw new Error('cannot delete public message on a non public groups');
  }

  if (convo.isOpenGroupV2()) {
    const roomInfos = convo.toOpenGroupV2();
    // on v2 servers we can only remove a single message per request..
    // so logic here is to delete each messages and get which one where not removed
    const validServerIdsToRemove = _.compact(
      messages.map(msg => {
        const serverId = msg.get('serverId');
        return serverId;
      })
    );

    const validMessageModelsToRemove = _.compact(
      messages.map(msg => {
        const serverId = msg.get('serverId');
        if (serverId) {
          return msg;
        }
        return undefined;
      })
    );

    let allMessagesAreDeleted: boolean = false;
    if (validServerIdsToRemove.length) {
      allMessagesAreDeleted = await ApiV2.deleteMessageByServerIds(
        validServerIdsToRemove,
        roomInfos
      );
    }
    // remove only the messages we managed to remove on the server
    if (allMessagesAreDeleted) {
      window?.log?.info('Removed all those serverIds messages successfully');
      return validMessageModelsToRemove;
    } else {
      window?.log?.info(
        'failed to remove all those serverIds message. not removing them locally neither'
      );
      return [];
    }
  } else if (convo.isOpenGroupV1()) {
    const channelAPI = await convo.getPublicSendData();

    if (!channelAPI) {
      throw new Error('Unable to get public channel API');
    }

    const invalidMessages = messages.filter(m => !m.attributes.serverId);
    const pendingMessages = messages.filter(m => m.attributes.serverId);

    let deletedServerIds = [];
    let ignoredServerIds = [];

    if (pendingMessages.length > 0) {
      const result = await channelAPI.deleteMessages(
        pendingMessages.map(m => m.attributes.serverId)
      );
      deletedServerIds = result.deletedIds;
      ignoredServerIds = result.ignoredIds;
    }

    const toDeleteLocallyServerIds = _.union(deletedServerIds, ignoredServerIds);
    let toDeleteLocally = messages.filter(m =>
      toDeleteLocallyServerIds.includes(m.attributes.serverId)
    );
    toDeleteLocally = _.union(toDeleteLocally, invalidMessages);

    await Promise.all(
      toDeleteLocally.map(async m => {
        await convo.removeMessage(m.id);
      })
    );

    await convo.updateLastMessage();

    return toDeleteLocally;
  }
  return [];
}

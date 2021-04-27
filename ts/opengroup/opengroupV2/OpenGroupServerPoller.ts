import { AbortController } from 'abort-controller';
import { ConversationController } from '../../session/conversations';
import { getOpenGroupV2ConversationId } from '../utils/OpenGroupUtils';
import { OpenGroupRequestCommonType } from './ApiUtil';
import { compactFetchEverything, ParsedRoomCompactPollResults } from './OpenGroupAPIV2CompactPoll';
import _ from 'lodash';
import { ConversationModel } from '../../models/conversation';
import { getMessageIdsFromServerIds, removeMessage } from '../../data/data';
import { getV2OpenGroupRoom, saveV2OpenGroupRoom } from '../../data/opengroups';
import { OpenGroupMessageV2 } from './OpenGroupMessageV2';
import { handleOpenGroupV2Message } from '../../receiver/receiver';

const pollForEverythingInterval = 4 * 1000;

/**
 * An OpenGroupServerPollerV2 polls for everything for a particular server. We should
 * have only have one OpenGroupServerPollerV2 per opengroup polling.
 *
 * So even if you have several rooms on the same server, you should only have one OpenGroupServerPollerV2
 * for this server.
 */
export class OpenGroupServerPoller {
  private readonly serverUrl: string;
  private readonly roomIdsToPoll: Set<string> = new Set();
  private pollForEverythingTimer?: NodeJS.Timeout;
  private readonly abortController: AbortController;

  /**
   * isPolling is set to true when we have a request going for this serverUrl.
   * If we have an interval tick while we still doing a request, the new one will be dropped
   * and only the current one will finish.
   * This is to ensure that we don't trigger too many request at the same time
   */
  private isPolling = false;
  private wasStopped = false;

  constructor(roomInfos: Array<OpenGroupRequestCommonType>) {
    if (!roomInfos?.length) {
      throw new Error('Empty roomInfos list');
    }
    // check that all rooms are from the same serverUrl
    const firstUrl = roomInfos[0].serverUrl;
    const every = roomInfos.every(r => r.serverUrl === firstUrl);
    if (!every) {
      throw new Error('All rooms must be for the same serverUrl');
    }
    // first verify the rooms we got are all from on the same server

    this.serverUrl = firstUrl;
    roomInfos.forEach(r => {
      this.roomIdsToPoll.add(r.roomId);
    });

    this.abortController = new AbortController();
    this.compactPoll = this.compactPoll.bind(this);
    this.pollForEverythingTimer = global.setInterval(this.compactPoll, pollForEverythingInterval);
  }

  /**
   * Add a room to the polled room for this server.
   * If a request is already in progress, it will be added only on the next run.
   * The interval is always ticking, even doing nothing except realizing it has nothing to do
   */
  public addRoomToPoll(room: OpenGroupRequestCommonType) {
    if (room.serverUrl !== this.serverUrl) {
      throw new Error('All rooms must be for the same serverUrl');
    }
    if (this.roomIdsToPoll.has(room.roomId)) {
      window.log.info('skipping addRoomToPoll of already polled room:', room);
      return;
    }
    this.roomIdsToPoll.add(room.roomId);
  }

  public removeRoomFromPoll(room: OpenGroupRequestCommonType) {
    if (room.serverUrl !== this.serverUrl) {
      window.log.info('this is not the correct ServerPoller');
      return;
    }
    if (this.roomIdsToPoll.has(room.roomId)) {
      window.log.info(`Removing ${room.roomId} from polling for ${this.serverUrl}`);
      this.roomIdsToPoll.delete(room.roomId);
    } else {
      window.log.info(
        `Cannot remove polling of ${room.roomId} as it is not polled on ${this.serverUrl}`
      );
    }
  }

  public getPolledRoomsCount() {
    return this.roomIdsToPoll.size;
  }

  /**
   * Stop polling.
   * Requests currently being made will we canceled.
   * You can NOT restart for now a stopped serverPoller.
   * This has to be used only for quiting the app.
   */
  public stop() {
    if (this.pollForEverythingTimer) {
      global.clearInterval(this.pollForEverythingTimer);
      this.abortController?.abort();
      this.pollForEverythingTimer = undefined;
      this.wasStopped = true;
    }
  }

  private shouldPoll() {
    if (this.wasStopped) {
      window.log.error('Serverpoller was stopped. CompactPoll should not happen');
      return false;
    }
    if (!this.roomIdsToPoll.size) {
      return false;
    }
    // return early if a poll is already in progress
    if (this.isPolling) {
      return false;
    }
    return true;
  }

  private async compactPoll() {
    if (!this.shouldPoll()) {
      return;
    }

    // do everything with throwing so we can check only at one place
    // what we have to clean
    try {
      this.isPolling = true;
      // don't try to make the request if we are aborted
      if (this.abortController.signal.aborted) {
        throw new Error('Poller aborted');
      }

      let compactFetchResults = await compactFetchEverything(
        this.serverUrl,
        this.roomIdsToPoll,
        this.abortController.signal
      );

      // check that we are still not aborted
      if (this.abortController.signal.aborted) {
        throw new Error('Abort controller was canceled. dropping request');
      }
      if (!compactFetchResults) {
        throw new Error('compactFetch: no results');
      }
      // we were not aborted, make sure to filter out roomIds we are not polling for anymore
      compactFetchResults = compactFetchResults.filter(result =>
        this.roomIdsToPoll.has(result.roomId)
      );
      // window.log.debug(`compactFetchResults for ${this.serverUrl}:`, compactFetchResults);

      // ==> At this point all those results need to trigger conversation updates, so update what we have to update
      await handleCompactPollResults(this.serverUrl, compactFetchResults);
    } catch (e) {
      window.log.warn('Got error while compact fetch:', e);
    } finally {
      this.isPolling = false;
    }
  }
}

const handleDeletions = async (
  deletedIds: Array<number>,
  conversationId: string,
  convo?: ConversationModel
) => {
  try {
    const maxDeletedId = Math.max(...deletedIds);
    const messageIds = await getMessageIdsFromServerIds(deletedIds, conversationId);
    if (!messageIds?.length) {
      return;
    }
    const roomInfos = await getV2OpenGroupRoom(conversationId);
    if (roomInfos && roomInfos.lastMessageDeletedServerID !== maxDeletedId) {
      roomInfos.lastMessageDeletedServerID = maxDeletedId;
      await saveV2OpenGroupRoom(roomInfos);
    }

    await Promise.all(
      messageIds.map(async id => {
        if (convo) {
          await convo.removeMessage(id);
        }
        await removeMessage(id);
      })
    );
    // we want to try to update our lastDeletedId
  } catch (e) {
    window.log.warn('handleDeletions failed:', e);
  }
};

const handleNewMessages = async (
  newMessages: Array<OpenGroupMessageV2>,
  conversationId: string,
  convo?: ConversationModel
) => {
  try {
    const incomingMessageIds = _.compact(newMessages.map(n => n.serverId));
    const maxNewMessageId = Math.max(...incomingMessageIds);
    // TODO filter out duplicates ?
    const roomInfos = await getV2OpenGroupRoom(conversationId);
    if (!roomInfos || !roomInfos.serverUrl || !roomInfos.roomId) {
      throw new Error(`No room for convo ${conversationId}`);
    }

    const roomDetails: OpenGroupRequestCommonType = _.pick(roomInfos, 'serverUrl', 'roomId');

    // tslint:disable-next-line: prefer-for-of
    for (let index = 0; index < newMessages.length; index++) {
      const newMessage = newMessages[index];
      try {
        await handleOpenGroupV2Message(newMessage, roomDetails);
      } catch (e) {
        window.log.warn('handleOpenGroupV2Message', e);
      }
    }

    if (roomInfos && roomInfos.lastMessageFetchedServerID !== maxNewMessageId) {
      roomInfos.lastMessageFetchedServerID = maxNewMessageId;
      await saveV2OpenGroupRoom(roomInfos);
    }
  } catch (e) {
    window.log.warn('handleNewMessages failed:', e);
  }
};

const handleCompactPollResults = async (
  serverUrl: string,
  results: Array<ParsedRoomCompactPollResults>
) => {
  await Promise.all(
    results.map(async res => {
      const convoId = getOpenGroupV2ConversationId(serverUrl, res.roomId);
      const convo = ConversationController.getInstance().get(convoId);

      // we want to do deletions even if we somehow lost the convo.
      if (res.deletions.length) {
        // new deletions
        await handleDeletions(res.deletions, convoId, convo);
      }

      if (res.messages.length) {
        // new messages
        await handleNewMessages(res.messages, convoId, convo);
      }

      if (!convo) {
        window.log.warn('Could not find convo for compactPoll', convoId);
        return;
      }
      const existingModerators = convo.get('moderators') || [];
      let changeOnConvo = false;
      if (!_.isEqual(existingModerators.sort(), res.moderators.sort())) {
        convo.set({ moderators: res.moderators });
        changeOnConvo = true;
      }

      if (changeOnConvo) {
        await convo.commit();
      }
    })
  );
};

import { AbortController } from 'abort-controller';
import { getConversationController } from '../../../conversations';
import { getOpenGroupV2ConversationId } from '../utils/OpenGroupUtils';
import { OpenGroupRequestCommonType } from './ApiUtil';
import {
  compactFetchEverything,
  getAllBase64AvatarForRooms,
  getAllMemberCount,
  ParsedBase64Avatar,
  ParsedDeletions,
  ParsedMemberCount,
  ParsedRoomCompactPollResults,
} from './OpenGroupAPIV2CompactPoll';
import _, { now } from 'lodash';
import { ConversationModel } from '../../../../models/conversation';
import { getMessageIdsFromServerIds, removeMessage } from '../../../../data/data';
import { getV2OpenGroupRoom, saveV2OpenGroupRoom } from '../../../../data/opengroups';
import { OpenGroupMessageV2 } from './OpenGroupMessageV2';
import autoBind from 'auto-bind';
import { sha256 } from '../../../crypto';
import { DURATION } from '../../../constants';
import { processNewAttachment } from '../../../../types/MessageAttachment';
import { MIME } from '../../../../types';
import { handleOpenGroupV2Message } from '../../../../receiver/opengroup';
import { callUtilsWorker } from '../../../../webworker/workers/util_worker_interface';
import { filterDuplicatesFromDbAndIncoming } from './SogsFilterDuplicate';

const pollForEverythingInterval = DURATION.SECONDS * 10;
const pollForRoomAvatarInterval = DURATION.DAYS * 1;
const pollForMemberCountInterval = DURATION.MINUTES * 10;

/**
 * An OpenGroupServerPollerV2 polls for everything for a particular server. We should
 * have only have one OpenGroupServerPollerV2 per opengroup polling.
 *
 * So even if you have several rooms on the same server, you should only have one OpenGroupServerPollerV2
 * for this server.
 */
export class OpenGroupServerPoller {
  /**
   * The server url to poll for this opengroup poller.
   * Remember, we have one poller per opengroup poller, no matter how many rooms we have joined on this same server
   */
  private readonly serverUrl: string;

  /**
   * The set of rooms to poll from.
   *
   */
  private readonly roomIdsToPoll: Set<string> = new Set();

  /**
   * This timer is used to tick for compact Polling for this opengroup server
   * It ticks every `pollForEverythingInterval` except.
   * If the last run is still in progress, the new one won't start and just return.
   */
  private pollForEverythingTimer?: NodeJS.Timeout;
  private pollForRoomAvatarTimer?: NodeJS.Timeout;
  private pollForMemberCountTimer?: NodeJS.Timeout;
  private readonly abortController: AbortController;

  /**
   * isPolling is set to true when we have a request going for this serverUrl.
   * If we have an interval tick while we still doing a request, the new one will be dropped
   * and only the current one will finish.
   * This is to ensure that we don't trigger too many request at the same time
   */
  private isPolling = false;
  private isPreviewPolling = false;
  private isMemberCountPolling = false;
  private wasStopped = false;

  constructor(roomInfos: Array<OpenGroupRequestCommonType>) {
    autoBind(this);

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
    window?.log?.info(`Creating a new OpenGroupServerPoller for url ${firstUrl}`);
    this.serverUrl = firstUrl;
    roomInfos.forEach(r => {
      window?.log?.info(
        `Adding room on construct for url serverUrl: ${firstUrl}, roomId:'${r.roomId}' to poller:${this.serverUrl}`
      );
      this.roomIdsToPoll.add(r.roomId);
    });

    this.abortController = new AbortController();
    this.pollForEverythingTimer = global.setInterval(this.compactPoll, pollForEverythingInterval);
    this.pollForRoomAvatarTimer = global.setInterval(
      this.previewPerRoomPoll,
      pollForRoomAvatarInterval
    );
    this.pollForMemberCountTimer = global.setInterval(
      this.pollForAllMemberCount,
      pollForMemberCountInterval
    );

    if (this.roomIdsToPoll.size) {
      void this.triggerPollAfterAdd();
    }
  }

  /**
   * Add a room to the polled room for this server.
   * If a request is already in progress, it will be added only on the next run.
   */
  public addRoomToPoll(room: OpenGroupRequestCommonType) {
    if (room.serverUrl !== this.serverUrl) {
      throw new Error('All rooms must be for the same serverUrl');
    }
    if (this.roomIdsToPoll.has(room.roomId)) {
      window?.log?.info('skipping addRoomToPoll of already polled room:', room);
      return;
    }
    window?.log?.info(
      `Adding room on addRoomToPoll for url serverUrl: ${this.serverUrl}, roomId:'${room.roomId}' to poller:${this.serverUrl}`
    );
    this.roomIdsToPoll.add(room.roomId);

    // if we are not already polling right now, trigger a polling
    void this.triggerPollAfterAdd(room);
  }

  public removeRoomFromPoll(room: OpenGroupRequestCommonType) {
    if (room.serverUrl !== this.serverUrl) {
      window?.log?.info('this is not the correct ServerPoller');
      return;
    }
    if (this.roomIdsToPoll.has(room.roomId)) {
      window?.log?.info(`Removing ${room.roomId} from polling for ${this.serverUrl}`);
      this.roomIdsToPoll.delete(room.roomId);
    } else {
      window?.log?.info(
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
    if (this.pollForRoomAvatarTimer) {
      global.clearInterval(this.pollForRoomAvatarTimer);
    }

    if (this.pollForMemberCountTimer) {
      global.clearInterval(this.pollForMemberCountTimer);
    }
    if (this.pollForEverythingTimer) {
      // cancel next ticks for each timer
      global.clearInterval(this.pollForEverythingTimer);

      // abort current requests
      this.abortController?.abort();
      this.pollForEverythingTimer = undefined;
      this.pollForRoomAvatarTimer = undefined;
      this.pollForMemberCountTimer = undefined;
      this.wasStopped = true;
    }
  }

  private async triggerPollAfterAdd(_room?: OpenGroupRequestCommonType) {
    await this.compactPoll();
    await this.previewPerRoomPoll();
    await this.pollForAllMemberCount();
  }

  private shouldPoll() {
    if (this.wasStopped) {
      window?.log?.error('Serverpoller was stopped. CompactPoll should not happen');
      return false;
    }
    if (!this.roomIdsToPoll.size) {
      return false;
    }
    // return early if a poll is already in progress
    if (this.isPolling) {
      return false;
    }

    if (!window.getGlobalOnlineStatus()) {
      window?.log?.info('OpenGroupServerPoller: offline');
      return false;
    }
    return true;
  }

  private shouldPollPreview() {
    if (this.wasStopped) {
      window?.log?.error('Serverpoller was stopped. PollPreview should not happen');
      return false;
    }
    if (!this.roomIdsToPoll.size) {
      return false;
    }
    // return early if a poll is already in progress
    if (this.isPreviewPolling) {
      return false;
    }
    if (!window.getGlobalOnlineStatus()) {
      window?.log?.info('OpenGroupServerPoller: offline');
      return false;
    }
    return true;
  }

  private shouldPollForMemberCount() {
    if (this.wasStopped) {
      window?.log?.error('Serverpoller was stopped. PolLForMemberCount should not happen');
      return false;
    }
    if (!this.roomIdsToPoll.size) {
      return false;
    }
    // return early if a poll is already in progress
    if (this.isMemberCountPolling) {
      return false;
    }
    if (!window.getGlobalOnlineStatus()) {
      window?.log?.info('OpenGroupServerPoller: offline');
      return false;
    }
    return true;
  }

  private async previewPerRoomPoll() {
    if (!this.shouldPollPreview()) {
      return;
    }

    // do everything with throwing so we can check only at one place
    // what we have to clean
    try {
      this.isPreviewPolling = true;
      // don't try to make the request if we are aborted
      if (this.abortController.signal.aborted) {
        throw new Error('Poller aborted');
      }

      let previewGotResults = await getAllBase64AvatarForRooms(
        this.serverUrl,
        this.roomIdsToPoll,
        this.abortController.signal
      );

      // check that we are still not aborted
      if (this.abortController.signal.aborted) {
        throw new Error('Abort controller was canceled. Dropping preview request');
      }
      if (!previewGotResults) {
        throw new Error('getPreview: no results');
      }
      // we were not aborted, make sure to filter out roomIds we are not polling for anymore
      previewGotResults = previewGotResults.filter(result => this.roomIdsToPoll.has(result.roomId));

      // ==> At this point all those results need to trigger conversation updates, so update what we have to update
      await handleBase64AvatarUpdate(this.serverUrl, previewGotResults);
    } catch (e) {
      window?.log?.warn('Got error while preview fetch:', e);
    } finally {
      this.isPreviewPolling = false;
    }
  }

  private async pollForAllMemberCount() {
    if (!this.shouldPollForMemberCount()) {
      return;
    }
    // do everything with throwing so we can check only at one place
    // what we have to clean
    try {
      this.isMemberCountPolling = true;
      // don't try to make the request if we are aborted
      if (this.abortController.signal.aborted) {
        throw new Error('Poller aborted');
      }

      let memberCountGotResults = await getAllMemberCount(
        this.serverUrl,
        this.roomIdsToPoll,
        this.abortController.signal
      );

      // check that we are still not aborted
      if (this.abortController.signal.aborted) {
        throw new Error('Abort controller was canceled. Dropping memberCount request');
      }
      if (!memberCountGotResults) {
        throw new Error('MemberCount: no results');
      }
      // we were not aborted, make sure to filter out roomIds we are not polling for anymore
      memberCountGotResults = memberCountGotResults.filter(result =>
        this.roomIdsToPoll.has(result.roomId)
      );

      // ==> At this point all those results need to trigger conversation updates, so update what we have to update
      await handleAllMemberCount(this.serverUrl, memberCountGotResults);
    } catch (e) {
      window?.log?.warn('Got error while memberCount fetch:', e);
    } finally {
      this.isMemberCountPolling = false;
    }
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

      // ==> At this point all those results need to trigger conversation updates, so update what we have to update
      await handleCompactPollResults(this.serverUrl, compactFetchResults);
    } catch (e) {
      window?.log?.warn('Got error while compact fetch:', e.message);
    } finally {
      this.isPolling = false;
    }
  }
}

const handleDeletions = async (
  deleted: ParsedDeletions,
  conversationId: string,
  convo?: ConversationModel
) => {
  const allIdsRemoved = (deleted || []).map(d => d.deleted_message_id);
  const allRowIds = (deleted || []).map(d => d.id);
  const maxDeletedId = Math.max(...allRowIds);
  try {
    const messageIds = await getMessageIdsFromServerIds(allIdsRemoved, conversationId);

    await Promise.all(
      (messageIds || []).map(async id => {
        if (convo) {
          await convo.removeMessage(id);
        }
        await removeMessage(id);
      })
    );
    //
  } catch (e) {
    window?.log?.warn('handleDeletions failed:', e);
  } finally {
    try {
      const roomInfos = await getV2OpenGroupRoom(conversationId);

      if (roomInfos && roomInfos.lastMessageDeletedServerID !== maxDeletedId) {
        roomInfos.lastMessageDeletedServerID = maxDeletedId;
        await saveV2OpenGroupRoom(roomInfos);
      }
    } catch (e) {
      window?.log?.warn('handleDeletions updating roomInfos failed:', e);
    }
  }
};

const handleNewMessages = async (
  newMessages: Array<OpenGroupMessageV2>,
  conversationId: string,
  _convo?: ConversationModel
) => {
  try {
    const roomInfos = await getV2OpenGroupRoom(conversationId);
    if (!roomInfos || !roomInfos.serverUrl || !roomInfos.roomId) {
      throw new Error(`No room for convo ${conversationId}`);
    }

    if (!newMessages.length) {
      // if we got no new messages, just write our last update timestamp to the db
      roomInfos.lastFetchTimestamp = Date.now();
      window?.log?.info(
        `No new messages for ${roomInfos.roomId}... just updating our last fetched timestamp`
      );
      await saveV2OpenGroupRoom(roomInfos);
      return;
    }
    const incomingMessageIds = _.compact(newMessages.map(n => n.serverId));
    const maxNewMessageId = Math.max(...incomingMessageIds);

    const roomDetails: OpenGroupRequestCommonType = _.pick(roomInfos, 'serverUrl', 'roomId');

    // this call filters duplicates based on the sender & senttimestamp from the incoming messages array and the database
    const filteredDuplicates = await filterDuplicatesFromDbAndIncoming(newMessages);

    const startHandleOpengroupMessage = now();
    // tslint:disable-next-line: prefer-for-of
    for (let index = 0; index < filteredDuplicates.length; index++) {
      const newMessage = filteredDuplicates[index];
      try {
        await handleOpenGroupV2Message(newMessage, roomDetails);
      } catch (e) {
        window?.log?.warn('handleOpenGroupV2Message', e);
      }
    }

    window.log.debug(
      `[perf] handle ${filteredDuplicates.length} opengroupMessages took ${now() -
        startHandleOpengroupMessage}ms.`
    );

    // we need to update the timestamp even if we don't have a new MaxMessageServerId
    if (roomInfos) {
      roomInfos.lastMessageFetchedServerID = maxNewMessageId;
      roomInfos.lastFetchTimestamp = Date.now();
      await saveV2OpenGroupRoom(roomInfos);
    }
  } catch (e) {
    window?.log?.warn('handleNewMessages failed:', e);
  }
};

const handleCompactPollResults = async (
  serverUrl: string,
  results: Array<ParsedRoomCompactPollResults>
) => {
  await Promise.all(
    results.map(async res => {
      const convoId = getOpenGroupV2ConversationId(serverUrl, res.roomId);
      const convo = getConversationController().get(convoId);

      // we want to do deletions even if we somehow lost the convo.
      if (res.deletions.length) {
        // new deletions
        await handleDeletions(res.deletions, convoId, convo);
      }

      // new messages. call this even if we don't have new messages
      await handleNewMessages(res.messages, convoId, convo);

      if (!convo) {
        window?.log?.warn('Could not find convo for compactPoll', convoId);
        return;
      }

      // this already do the commit
      await convo.updateGroupAdmins(res.moderators);
    })
  );
};

const handleBase64AvatarUpdate = async (
  serverUrl: string,
  avatarResults: Array<ParsedBase64Avatar>
) => {
  await Promise.all(
    avatarResults.map(async res => {
      const convoId = getOpenGroupV2ConversationId(serverUrl, res.roomId);
      const convo = getConversationController().get(convoId);
      if (!convo) {
        window?.log?.warn('Could not find convo for compactPoll', convoId);
        return;
      }
      if (!res.base64) {
        window?.log?.info('getPreview: no base64 data. skipping');
        return;
      }
      const existingHash = convo.get('avatarHash');
      const newHash = sha256(res.base64);
      if (newHash !== existingHash) {
        // write the file to the disk (automatically encrypted),
        // ArrayBuffer

        const upgradedAttachment = await processNewAttachment({
          isRaw: true,
          data: await callUtilsWorker('fromBase64ToArrayBuffer', res.base64),
          contentType: MIME.IMAGE_UNKNOWN, // contentType is mostly used to generate previews and screenshot. We do not care for those in this case.          // url: `${serverUrl}/${res.roomId}`,
        });
        // update the hash on the conversationModel
        await convo.setLokiProfile({
          displayName: convo.getName() || window.i18n('unknown'),
          avatar: upgradedAttachment.path,
          avatarHash: newHash,
        });
        convo.set({
          avatarHash: newHash,
        });
        // trigger the write to db and refresh the UI
        await convo.commit();
      }
    })
  );
};

async function handleAllMemberCount(
  serverUrl: string,
  memberCountGotResults: Array<ParsedMemberCount>
) {
  if (!memberCountGotResults.length) {
    return;
  }

  await Promise.all(
    memberCountGotResults.map(async roomCount => {
      const conversationId = getOpenGroupV2ConversationId(serverUrl, roomCount.roomId);

      const convo = getConversationController().get(conversationId);
      if (!convo) {
        window?.log?.warn('cannot update conversation memberCount as it does not exist');
        return;
      }
      if (convo.get('subscriberCount') !== roomCount.memberCount) {
        convo.set({ subscriberCount: roomCount.memberCount });
        // triggers the save to db and the refresh of the UI
        await convo.commit();
      }
    })
  );
}

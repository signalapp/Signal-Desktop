/* eslint-disable no-loop-func */
/* eslint-disable no-restricted-syntax */
import { AbortController } from 'abort-controller';
import { isNumber, isObject } from 'lodash';
import autoBind from 'auto-bind';

import { getOpenGroupV2ConversationId } from '../utils/OpenGroupUtils';

import { OpenGroupData } from '../../../../data/opengroups';
import { OpenGroupMessageV2 } from './OpenGroupMessageV2';
import { DURATION } from '../../../constants';
import {
  batchGlobalIsSuccess,
  OpenGroupBatchRow,
  parseBatchGlobalStatusCode,
  sogsBatchSend,
  SubRequestMessagesObjectType,
} from '../sogsv3/sogsV3BatchPoll';
import { handleBatchPollResults } from '../sogsv3/sogsApiV3';
import { fetchCapabilitiesAndUpdateRelatedRoomsOfServerUrl } from '../sogsv3/sogsV3Capabilities';
import { OpenGroupReaction } from '../../../../types/Reaction';
import {
  markConversationInitialLoadingInProgress,
  openConversationWithMessages,
} from '../../../../state/ducks/conversations';
import { roomHasBlindEnabled } from '../../../../types/sqlSharedTypes';
import { Storage } from '../../../../util/storage';
import { SettingsKey } from '../../../../data/settings-key';
import { OpenGroupRequestCommonType } from '../../../../data/types';

export type OpenGroupMessageV4 = {
  /** AFAIK: indicates the number of the message in the group. e.g. 2nd message will be 1 or 2 */
  seqno: number;
  session_id?: string;
  /** base64 */
  signature?: string;
  /** timestamp number with decimal */
  posted?: number;
  id: number;
  data?: string;
  deleted?: boolean;
  reactions: Record<string, OpenGroupReaction>;
};

// seqno is not set for SOGS < 1.3.4
export type OpenGroupReactionMessageV4 = Omit<OpenGroupMessageV4, 'seqno'> & {
  seqno: number | undefined;
};

const pollForEverythingInterval = DURATION.SECONDS * 10;

export const invalidAuthRequiresBlinding =
  'Invalid authentication: this server requires the use of blinded ids';

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
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.pollForEverythingTimer = global.setInterval(this.compactPoll, pollForEverythingInterval);

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
    if (this.roomIdsToPoll.has(room.roomId) || this.roomIdsToPoll.has(room.roomId.toLowerCase())) {
      window?.log?.info(`Removing ${room.roomId} from polling for ${this.serverUrl}`);
      this.roomIdsToPoll.delete(room.roomId);
      this.roomIdsToPoll.delete(room.roomId.toLowerCase());
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
   * This has to be used only for quitting the app.
   */
  public stop() {
    if (this.pollForEverythingTimer) {
      // cancel next ticks for each timer
      global.clearInterval(this.pollForEverythingTimer);

      // abort current requests
      this.abortController?.abort();
      this.pollForEverythingTimer = undefined;
      this.wasStopped = true;
    }
  }

  private async triggerPollAfterAdd(_room?: OpenGroupRequestCommonType) {
    await this.compactPoll();
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

  /**
   * creates subrequest options for a batch request.
   * We need: capabilities, pollInfo, recent messages, DM request inbox messages
   * @returns Array of subrequest options for our main batch request
   */
  private async makeSubrequestInfo() {
    const subrequestOptions: Array<OpenGroupBatchRow> = [];

    // capabilities
    subrequestOptions.push({
      type: 'capabilities',
    });

    // adding room specific SOGS subrequests
    this.roomIdsToPoll.forEach(roomId => {
      // poll info
      subrequestOptions.push({
        type: 'pollInfo',
        pollInfo: {
          roomId,
          infoUpdated: 0,
        },
      });

      const convoId = getOpenGroupV2ConversationId(this.serverUrl, roomId);
      const roomInfos = OpenGroupData.getV2OpenGroupRoom(convoId);

      // messages
      subrequestOptions.push({
        type: 'messages',
        messages: {
          roomId,
          sinceSeqNo: roomInfos?.maxMessageFetchedSeqNo,
        },
      });
    });

    if (this.serverUrl) {
      const rooms = OpenGroupData.getV2OpenGroupRoomsByServerUrl(this.serverUrl);
      if (rooms?.length) {
        if (roomHasBlindEnabled(rooms[0])) {
          const maxInboxId = Math.max(...rooms.map(r => r.lastInboxIdFetched || 0));

          if (Storage.get(SettingsKey.hasBlindedMsgRequestsEnabled)) {
            // This only works for servers with blinding capabilities
            // adding inbox subrequest info
            subrequestOptions.push({
              type: 'inbox',
              inboxSince: { id: isNumber(maxInboxId) && maxInboxId > 0 ? maxInboxId : undefined },
            });
          }

          const maxOutboxId = Math.max(...rooms.map(r => r.lastOutboxIdFetched || 0));

          // This only works for servers with blinding capabilities
          // adding outbox subrequest info
          subrequestOptions.push({
            type: 'outbox',
            outboxSince: { id: isNumber(maxOutboxId) && maxOutboxId > 0 ? maxOutboxId : undefined },
          });
        }
      }
    }

    return subrequestOptions;
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

      const subrequestOptions: Array<OpenGroupBatchRow> = await this.makeSubrequestInfo();

      if (!subrequestOptions || subrequestOptions.length === 0) {
        throw new Error('compactFetch: no subrequestOptions');
      }

      const batchPollResults = await sogsBatchSend(
        this.serverUrl,
        this.roomIdsToPoll,
        this.abortController.signal,
        subrequestOptions,
        'batch'
      );

      if (!batchPollResults) {
        throw new Error('compactFetch: no batchPollResults');
      }

      // check that we are still not aborted
      if (this.abortController.signal.aborted) {
        throw new Error('Abort controller was cancelled. dropping request');
      }

      // if we get a plaintext response from the sogs, it is stored under plainText field
      // see decodeV4Response()
      if (
        parseBatchGlobalStatusCode(batchPollResults) === 400 &&
        batchPollResults.body &&
        isObject(batchPollResults.body)
      ) {
        const bodyPlainText = (batchPollResults.body as any).plainText;
        // this is temporary (as of 27/06/2022) as we want to not support unblinded sogs after some time
        if (bodyPlainText === invalidAuthRequiresBlinding) {
          await fetchCapabilitiesAndUpdateRelatedRoomsOfServerUrl(this.serverUrl);
          throw new Error('batchPollResults just detected switch to blinded enforced.');
        }
      }

      if (!batchGlobalIsSuccess(batchPollResults)) {
        throw new Error('batchPollResults general status code is not 200');
      }

      // ==> At this point all those results need to trigger conversation updates, so update what we have to update
      await handleBatchPollResults(this.serverUrl, batchPollResults, subrequestOptions);

      // this is very hacky but is needed to remove the spinner of an opengroup conversation while it loads the first patch of messages.
      // Absolutely not the react way, but well.
      for (const room of subrequestOptions) {
        if (room.type === 'messages' && !room.messages?.sinceSeqNo && room.messages?.roomId) {
          const conversationKey = getOpenGroupV2ConversationId(
            this.serverUrl,
            room.messages.roomId
          );

          global.setTimeout(() => {
            const stateConversations = window.inboxStore?.getState().conversations;
            if (
              stateConversations.conversationLookup?.[conversationKey]?.isInitialFetchingInProgress
            ) {
              if (
                stateConversations.selectedConversation &&
                conversationKey === stateConversations.selectedConversation
              ) {
                // eslint-disable-next-line more/no-then
                void openConversationWithMessages({ conversationKey, messageId: null }).then(() => {
                  window.inboxStore?.dispatch(
                    markConversationInitialLoadingInProgress({
                      conversationKey,
                      isInitialFetchingInProgress: false,
                    })
                  );
                });
              } else {
                window.inboxStore?.dispatch(
                  markConversationInitialLoadingInProgress({
                    conversationKey,
                    isInitialFetchingInProgress: false,
                  })
                );
              }
            }
          }, 5000);
        }
      }
    } catch (e) {
      window?.log?.warn('Got error while compact fetch:', e.message);
    } finally {
      this.isPolling = false;
    }
  }
}

export const getRoomAndUpdateLastFetchTimestamp = async (
  conversationId: string,
  newMessages: Array<OpenGroupMessageV2 | OpenGroupMessageV4>,
  _subRequest: SubRequestMessagesObjectType
) => {
  const roomInfos = OpenGroupData.getV2OpenGroupRoom(conversationId);
  if (!roomInfos || !roomInfos.serverUrl || !roomInfos.roomId) {
    throw new Error(`No room for convo ${conversationId}`);
  }

  if (!newMessages.length) {
    // if we got no new messages, just write our last update timestamp to the db
    roomInfos.lastFetchTimestamp = Date.now();
    await OpenGroupData.saveV2OpenGroupRoom(roomInfos);
    return null;
  }
  return roomInfos;
};

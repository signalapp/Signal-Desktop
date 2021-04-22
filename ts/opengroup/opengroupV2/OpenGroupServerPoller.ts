import { AbortController } from 'abort-controller';
import { OpenGroupRequestCommonType } from './ApiUtil';
import { compactFetchEverything } from './OpenGroupAPIV2CompactPoll';
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
  private abortController?: AbortController;

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
    this.serverUrl = firstUrl;
    roomInfos.forEach(r => {
      this.roomIdsToPoll.add(r.roomId);
    });

    this.abortController = new AbortController();
    this.pollForEverythingTimer = global.setInterval(this.compactPoll, pollForEverythingInterval);

    // first verify the rooms we got are all from on the same server
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

  private async compactPoll() {
    if (this.wasStopped) {
      window.log.error('serverpoller was stopped. CompactPoll should not happen');
      return;
    }
    if (!this.roomIdsToPoll.size) {
      return;
    }
    // return early if a poll is already in progress
    if (this.isPolling) {
      return;
    }
    // do everything with throwing so we can check only at one place
    // what we have to clean
    try {
      this.isPolling = true;
      if (!this.abortController || this.abortController.signal.aborted) {
        throw new Error('Poller aborted');
      }

      let compactFetchResults = await compactFetchEverything(
        this.serverUrl,
        this.roomIdsToPoll,
        this.abortController.signal
      );

      if (this.abortController && this.abortController.signal.aborted) {
        this.abortController = undefined;
        window.log.warn('Abort controller was canceled. dropping request');
        return;
      }
      if (!compactFetchResults) {
        window.log.info('compactFetch: no results');
        return;
      }
      // we were not aborted, just make sure to filter out roomIds we are not polling for anymore
      compactFetchResults = compactFetchResults.filter(result =>
        this.roomIdsToPoll.has(result.roomId)
      );
      window.log.warn(`compactFetchResults for ${this.serverUrl}:`, compactFetchResults);
    } catch (e) {
      window.log.warn('Got error while compact fetch:', e);
    } finally {
      if (this.abortController && this.abortController.signal.aborted) {
        this.abortController = undefined;
        window.log.warn('Abort controller was canceled. dropping request');
      }
      this.isPolling = false;
    }
  }
}

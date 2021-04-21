import { AbortController } from 'abort-controller';
import { OpenGroupV2Room } from '../../data/opengroups';

export class OpenGroupPollerV2 {
  private static readonly pollForEverythingInterval = 4 * 1000;

  private readonly openGroupRoom: OpenGroupV2Room;

  private pollForEverythingTimer?: NodeJS.Timeout;

  private abortController?: AbortController;

  private hasStarted = false;
  private isPolling = false;

  constructor(openGroupRoom: OpenGroupV2Room) {
    this.openGroupRoom = openGroupRoom;
  }

  public startIfNeeded() {
    if (this.hasStarted) {
      return;
    }

    this.hasStarted = true;
    this.abortController = new AbortController();
    this.pollForEverythingTimer = global.setInterval(
      this.compactPoll,
      OpenGroupPollerV2.pollForEverythingInterval
    );
  }

  public stop() {
    if (this.pollForEverythingTimer) {
      global.clearInterval(this.pollForEverythingTimer);
      this.abortController?.abort();
      this.abortController = undefined;
      this.pollForEverythingTimer = undefined;
    }
  }

  private async compactPoll() {
    // return early if a poll is already in progress
    if (this.isPolling) {
      return;
    }
    this.isPolling = true;
    window.log.warn('pollForNewMessages TODO');
    // use abortController and do not trigger new messages if it was canceled
    this.isPolling = false;
  }
}

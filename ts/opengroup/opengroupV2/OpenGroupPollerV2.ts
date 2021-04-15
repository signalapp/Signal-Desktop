import { AbortController } from 'abort-controller';
import { OpenGroupV2Room } from '../../data/opengroups';

export class OpenGroupPollerV2 {
  private readonly openGroupRoom: OpenGroupV2Room;

  private pollForNewMessagesTimer?: NodeJS.Timeout;
  private pollForDeletedMessagesTimer?: NodeJS.Timeout;
  private pollForModeratorsTimer?: NodeJS.Timeout;

  private abortController?: AbortController;

  private hasStarted = false;
  private isPollingForMessages = false;

  private readonly pollForNewMessagesInterval = 4 * 1000;
  private readonly pollForDeletedMessagesInterval = 30 * 1000;
  private readonly pollForModeratorsInterval = 10 * 60 * 1000;

  constructor(openGroupRoom: OpenGroupV2Room) {
    this.openGroupRoom = openGroupRoom;
  }

  public startIfNeeded() {
    if (this.hasStarted) {
      return;
    }

    this.hasStarted = true;
    this.pollForNewMessagesTimer = global.setInterval(
      this.pollForNewMessages,
      this.pollForNewMessagesInterval
    );

    this.pollForDeletedMessagesTimer = global.setInterval(
      this.pollForDeletedMessages,
      this.pollForDeletedMessagesInterval
    );

    this.pollForModeratorsTimer = global.setInterval(
      this.pollForModerators,
      this.pollForModeratorsInterval
    );
  }

  public stop() {
    if (this.pollForNewMessagesTimer) {
      global.clearInterval(this.pollForNewMessagesTimer);
      this.pollForNewMessagesTimer = undefined;
    }
    if (this.pollForDeletedMessagesTimer) {
      global.clearInterval(this.pollForDeletedMessagesTimer);
      this.pollForDeletedMessagesTimer = undefined;
    }
    if (this.pollForModeratorsTimer) {
      global.clearInterval(this.pollForModeratorsTimer);
      this.pollForModeratorsTimer = undefined;
    }
  }

  private async pollForNewMessages() {
    // return early if a poll is already in progress
    if (this.isPollingForMessages) {
      return;
    }
    this.isPollingForMessages = true;
    window.log.warn('pollForNewMessages TODO');
    // use abortController and do not trigger new messages if it was canceled
    this.isPollingForMessages = false;
  }

  // tslint:disable: no-async-without-await
  private async pollForModerators() {
    window.log.warn('pollForModerators TODO');
    // use abortController
  }

  private async pollForDeletedMessages() {
    window.log.warn('pollForDeletedMessages TODO');
    // use abortController
  }
}

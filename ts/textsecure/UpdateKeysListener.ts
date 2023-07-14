// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isNumber } from 'lodash';

import * as durations from '../util/durations';
import { clearTimeoutIfNecessary } from '../util/clearTimeoutIfNecessary';
import * as Registration from '../util/registration';
import { UUIDKind } from '../types/UUID';
import * as log from '../logging/log';
import * as Errors from '../types/errors';

const UPDATE_INTERVAL = 2 * durations.DAY;
const UPDATE_TIME_STORAGE_KEY = 'nextScheduledUpdateKeyTime';

export type MinimalEventsType = {
  on(event: 'timetravel', callback: () => void): void;
};

let initComplete = false;

export class UpdateKeysListener {
  public timeout: NodeJS.Timeout | undefined;

  protected scheduleUpdateForNow(): void {
    const now = Date.now();
    void window.textsecure.storage.put(UPDATE_TIME_STORAGE_KEY, now);
  }

  protected setTimeoutForNextRun(): void {
    const now = Date.now();
    const time = window.textsecure.storage.get(UPDATE_TIME_STORAGE_KEY, now);

    log.info(
      'UpdateKeysListener: Next update scheduled for',
      new Date(time).toISOString()
    );

    let waitTime = time - now;
    if (waitTime < 0) {
      waitTime = 0;
    }

    clearTimeoutIfNecessary(this.timeout);
    this.timeout = setTimeout(() => this.runWhenOnline(), waitTime);
  }

  private scheduleNextUpdate(): void {
    const now = Date.now();
    const nextTime = now + UPDATE_INTERVAL;
    void window.textsecure.storage.put(UPDATE_TIME_STORAGE_KEY, nextTime);
  }

  private async run(): Promise<void> {
    log.info('UpdateKeysListener: Updating keys...');
    try {
      const accountManager = window.getAccountManager();

      await accountManager.maybeUpdateKeys(UUIDKind.ACI);
      await accountManager.maybeUpdateKeys(UUIDKind.PNI);

      this.scheduleNextUpdate();
      this.setTimeoutForNextRun();
    } catch (error) {
      const errorString = isNumber(error.code)
        ? error.code.toString()
        : Errors.toLogFormat(error);
      log.error(
        `UpdateKeysListener.run failure - trying again in five minutes ${errorString}`
      );
      setTimeout(() => this.setTimeoutForNextRun(), 5 * durations.MINUTE);
    }
  }

  private runWhenOnline() {
    if (window.navigator.onLine) {
      void this.run();
    } else {
      log.info(
        'UpdateKeysListener: We are offline; will update keys when we are next online'
      );
      const listener = () => {
        window.removeEventListener('online', listener);
        this.setTimeoutForNextRun();
      };
      window.addEventListener('online', listener);
    }
  }

  public static init(events: MinimalEventsType, newVersion: boolean): void {
    if (initComplete) {
      window.SignalContext.log.info('UpdateKeysListener: Already initialized');
      return;
    }
    initComplete = true;

    const listener = new UpdateKeysListener();

    if (newVersion) {
      listener.scheduleUpdateForNow();
    }
    listener.setTimeoutForNextRun();

    events.on('timetravel', () => {
      if (Registration.isDone()) {
        listener.setTimeoutForNextRun();
      }
    });
  }
}

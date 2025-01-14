// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as durations from '../util/durations';
import { clearTimeoutIfNecessary } from '../util/clearTimeoutIfNecessary';
import * as Registration from '../util/registration';
import { ServiceIdKind } from '../types/ServiceId';
import * as log from '../logging/log';
import * as Errors from '../types/errors';
import { HTTPError } from './Errors';

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
    this.timeout = setTimeout(() => this.#runWhenOnline(), waitTime);
  }

  #scheduleNextUpdate(): void {
    const now = Date.now();
    const nextTime = now + UPDATE_INTERVAL;
    void window.textsecure.storage.put(UPDATE_TIME_STORAGE_KEY, nextTime);
  }

  async #run(): Promise<void> {
    log.info('UpdateKeysListener: Updating keys...');
    try {
      const accountManager = window.getAccountManager();

      await accountManager.maybeUpdateKeys(ServiceIdKind.ACI);

      try {
        await accountManager.maybeUpdateKeys(ServiceIdKind.PNI);
      } catch (error) {
        if (
          error instanceof HTTPError &&
          (error.code === 422 || error.code === 403)
        ) {
          log.error(
            `UpdateKeysListener.run: Got a ${error.code} uploading PNI keys; unlinking`
          );
          window.Whisper.events.trigger('unlinkAndDisconnect');
        } else {
          const errorString =
            error instanceof HTTPError
              ? error.code.toString()
              : Errors.toLogFormat(error);
          log.error(
            `UpdateKeysListener.run: Failure uploading PNI keys. Not trying again. ${errorString}`
          );
        }
      }

      this.#scheduleNextUpdate();
      this.setTimeoutForNextRun();
    } catch (error) {
      const errorString =
        error instanceof HTTPError
          ? error.code.toString()
          : Errors.toLogFormat(error);
      log.error(
        `UpdateKeysListener.run failure - trying again in five minutes ${errorString}`
      );
      setTimeout(() => this.setTimeoutForNextRun(), 5 * durations.MINUTE);
    }
  }

  #runWhenOnline() {
    if (window.textsecure.server?.isOnline()) {
      void this.#run();
    } else {
      log.info(
        'UpdateKeysListener: We are offline; will update keys when we are next online'
      );
      const listener = () => {
        window.Whisper.events.off('online', listener);
        this.setTimeoutForNextRun();
      };
      window.Whisper.events.on('online', listener);
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

// Copyright 2017-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as durations from '../util/durations';
import { clearTimeoutIfNecessary } from '../util/clearTimeoutIfNecessary';
import { UUIDKind } from '../types/UUID';
import * as log from '../logging/log';

const ROTATION_INTERVAL = 2 * durations.DAY;

export type MinimalEventsType = {
  on(event: 'timetravel', callback: () => void): void;
};

let initComplete = false;

export class RotateSignedPreKeyListener {
  public timeout: NodeJS.Timeout | undefined;

  protected scheduleRotationForNow(): void {
    const now = Date.now();
    window.textsecure.storage.put('nextSignedKeyRotationTime', now);
  }

  protected setTimeoutForNextRun(): void {
    const now = Date.now();
    const time = window.textsecure.storage.get(
      'nextSignedKeyRotationTime',
      now
    );

    log.info(
      'Next signed key rotation scheduled for',
      new Date(time).toISOString()
    );

    let waitTime = time - now;
    if (waitTime < 0) {
      waitTime = 0;
    }

    clearTimeoutIfNecessary(this.timeout);
    this.timeout = setTimeout(() => this.runWhenOnline(), waitTime);
  }

  private scheduleNextRotation(): void {
    const now = Date.now();
    const nextTime = now + ROTATION_INTERVAL;
    window.textsecure.storage.put('nextSignedKeyRotationTime', nextTime);
  }

  private async run(): Promise<void> {
    log.info('Rotating signed prekey...');
    try {
      const accountManager = window.getAccountManager();
      await Promise.all([
        accountManager.rotateSignedPreKey(UUIDKind.ACI),
        accountManager.rotateSignedPreKey(UUIDKind.PNI),
      ]);
      this.scheduleNextRotation();
      this.setTimeoutForNextRun();
    } catch (error) {
      log.error('rotateSignedPrekey() failed. Trying again in five minutes');
      setTimeout(() => this.setTimeoutForNextRun(), 5 * durations.MINUTE);
    }
  }

  private runWhenOnline() {
    if (window.navigator.onLine) {
      this.run();
    } else {
      log.info('We are offline; keys will be rotated when we are next online');
      const listener = () => {
        window.removeEventListener('online', listener);
        this.setTimeoutForNextRun();
      };
      window.addEventListener('online', listener);
    }
  }

  public static init(events: MinimalEventsType, newVersion: boolean): void {
    if (initComplete) {
      window.SignalContext.log.info(
        'Rotate signed prekey listener: Already initialized'
      );
      return;
    }
    initComplete = true;

    const listener = new RotateSignedPreKeyListener();

    if (newVersion) {
      listener.scheduleRotationForNow();
    }
    listener.setTimeoutForNextRun();

    events.on('timetravel', () => {
      if (window.Signal.Util.Registration.isDone()) {
        listener.setTimeoutForNextRun();
      }
    });
  }
}

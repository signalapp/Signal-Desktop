// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import PQueue from 'p-queue';
import { MINUTE } from './durations';
import { Sound } from './Sound';

const ringtoneEventQueue = new PQueue({
  concurrency: 1,
  timeout: MINUTE * 30,
  throwOnTimeout: true,
});

class CallingTones {
  private ringtone?: Sound;

  async playEndCall(): Promise<void> {
    const canPlayTone = window.Events.getCallRingtoneNotification();
    if (!canPlayTone) {
      return;
    }

    const tone = new Sound({
      src: 'sounds/navigation-cancel.ogg',
    });
    await tone.play();
  }

  async playRingtone() {
    await ringtoneEventQueue.add(async () => {
      if (this.ringtone) {
        this.ringtone.stop();
        this.ringtone = undefined;
      }

      const canPlayTone = window.Events.getCallRingtoneNotification();
      if (!canPlayTone) {
        return;
      }

      this.ringtone = new Sound({
        loop: true,
        src: 'sounds/ringtone_minimal.ogg',
      });

      await this.ringtone.play();
    });
  }

  async stopRingtone() {
    await ringtoneEventQueue.add(async () => {
      if (this.ringtone) {
        this.ringtone.stop();
        this.ringtone = undefined;
      }
    });
  }

  async someonePresenting() {
    const canPlayTone = window.Events.getCallRingtoneNotification();
    if (!canPlayTone) {
      return;
    }

    const tone = new Sound({
      src: 'sounds/navigation_selection-complete-celebration.ogg',
    });

    await tone.play();
  }
}

export const callingTones = new CallingTones();

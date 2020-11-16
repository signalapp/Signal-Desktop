// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import PQueue from 'p-queue';
import { Sound } from './Sound';

const ringtoneEventQueue = new PQueue({
  concurrency: 1,
  timeout: 1000 * 60 * 2,
});

class CallingTones {
  private ringtone?: Sound;

  // eslint-disable-next-line class-methods-use-this
  async playEndCall(): Promise<void> {
    const canPlayTone = await window.getCallRingtoneNotification();
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

      const canPlayTone = await window.getCallRingtoneNotification();
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
}

export const callingTones = new CallingTones();

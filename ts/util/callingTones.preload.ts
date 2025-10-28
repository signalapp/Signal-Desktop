// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import PQueue from 'p-queue';
import { MINUTE } from './durations/index.std.js';
import { Sound, SoundType } from './Sound.std.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

const ringtoneEventQueue = new PQueue({
  concurrency: 1,
  timeout: MINUTE * 30,
  throwOnTimeout: true,
});

function getCallRingtoneNotificationSetting(): boolean {
  return itemStorage.get('call-ringtone-notification', true);
}

class CallingTones {
  #ringtone?: Sound;

  async handRaised() {
    const canPlayTone = getCallRingtoneNotificationSetting();
    if (!canPlayTone) {
      return;
    }

    const tone = new Sound({
      soundType: SoundType.CallingHandRaised,
    });

    await tone.play();
  }

  async playEndCall(): Promise<void> {
    const canPlayTone = getCallRingtoneNotificationSetting();
    if (!canPlayTone) {
      return;
    }

    const tone = new Sound({
      soundType: SoundType.CallingHangUp,
    });
    await tone.play();
  }

  async playRingtone() {
    await ringtoneEventQueue.add(async () => {
      if (this.#ringtone) {
        this.#ringtone.stop();
        this.#ringtone = undefined;
      }

      const canPlayTone = getCallRingtoneNotificationSetting();
      if (!canPlayTone) {
        return;
      }

      this.#ringtone = new Sound({
        loop: true,
        soundType: SoundType.Ringtone,
      });

      await this.#ringtone.play();
    });
  }

  async stopRingtone() {
    await ringtoneEventQueue.add(async () => {
      if (this.#ringtone) {
        this.#ringtone.stop();
        this.#ringtone = undefined;
      }
    });
  }

  async someonePresenting() {
    const canPlayTone = getCallRingtoneNotificationSetting();
    if (!canPlayTone) {
      return;
    }

    const tone = new Sound({
      soundType: SoundType.CallingPresenting,
    });

    await tone.play();
  }
}

export const callingTones = new CallingTones();

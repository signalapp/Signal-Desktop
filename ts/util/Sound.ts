// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../logging/log';
import { missingCaseError } from './missingCaseError';

export enum SoundType {
  CallingHangUp,
  CallingHandRaised,
  CallingPresenting,
  Pop,
  Ringtone,
  TriTone,
  VoiceNoteEnd,
  VoiceNoteStart,
  Whoosh,
}

export type SoundOpts = {
  loop?: boolean;
  soundType: SoundType;
};

export class Sound {
  static sounds = new Map<SoundType, AudioBuffer>();

  private static context: AudioContext | undefined;

  readonly #loop: boolean;
  #node?: AudioBufferSourceNode;
  readonly #soundType: SoundType;

  constructor(options: SoundOpts) {
    this.#loop = Boolean(options.loop);
    this.#soundType = options.soundType;
  }

  async play(): Promise<void> {
    let soundBuffer = Sound.sounds.get(this.#soundType);

    if (!soundBuffer) {
      try {
        const src = Sound.getSrc(this.#soundType);
        const buffer = await Sound.loadSoundFile(src);
        const decodedBuffer = await this.#context.decodeAudioData(buffer);
        Sound.sounds.set(this.#soundType, decodedBuffer);
        soundBuffer = decodedBuffer;
      } catch (err) {
        log.error(`Sound error: ${err}`);
        return;
      }
    }

    const soundNode = this.#context.createBufferSource();
    soundNode.buffer = soundBuffer;

    const volumeNode = this.#context.createGain();
    soundNode.connect(volumeNode);
    volumeNode.connect(this.#context.destination);

    soundNode.loop = this.#loop;

    soundNode.start(0, 0);

    this.#node = soundNode;
  }

  stop(): void {
    if (this.#node) {
      this.#node.stop(0);
      this.#node = undefined;
    }
  }

  get #context(): AudioContext {
    if (!Sound.context) {
      Sound.context = new AudioContext();
    }
    return Sound.context;
  }

  static async loadSoundFile(src: string): Promise<ArrayBuffer> {
    const xhr = new XMLHttpRequest();

    xhr.open('GET', src, true);
    xhr.responseType = 'arraybuffer';

    return new Promise((resolve, reject) => {
      xhr.onload = () => {
        if (xhr.status === 200) {
          resolve(xhr.response);
          return;
        }

        reject(new Error(`Request failed: ${xhr.statusText}`));
      };
      xhr.onerror = () => {
        reject(new Error(`Request failed, most likely file not found: ${src}`));
      };
      xhr.send();
    });
  }

  static getSrc(soundStyle: SoundType): string {
    if (soundStyle === SoundType.CallingHandRaised) {
      return 'sounds/notification_simple-01.ogg';
    }

    if (soundStyle === SoundType.CallingHangUp) {
      return 'sounds/navigation-cancel.ogg';
    }

    if (soundStyle === SoundType.CallingPresenting) {
      return 'sounds/navigation_selection-complete-celebration.ogg';
    }

    if (soundStyle === SoundType.Pop) {
      return 'sounds/pop.ogg';
    }

    if (soundStyle === SoundType.TriTone) {
      return 'sounds/notification.ogg';
    }

    if (soundStyle === SoundType.Ringtone) {
      return 'sounds/ringtone_minimal.ogg';
    }

    if (soundStyle === SoundType.VoiceNoteEnd) {
      return 'sounds/state-change_confirm-up.ogg';
    }

    if (soundStyle === SoundType.VoiceNoteStart) {
      return 'sounds/state-change_confirm-down.ogg';
    }

    if (soundStyle === SoundType.Whoosh) {
      return 'sounds/whoosh.ogg';
    }

    throw missingCaseError(soundStyle);
  }
}

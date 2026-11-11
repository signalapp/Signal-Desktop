// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isTestOrMockEnvironment } from '../environment.std.ts';
import { createLogger } from '../logging/log.std.ts';
import { drop } from './drop.std.ts';
import { missingCaseError } from './missingCaseError.std.ts';

const log = createLogger('Sound');

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

  private static playing = new Set<AudioBufferSourceNode>();

  readonly #loop: boolean;
  #playId = 0;
  #node?: AudioBufferSourceNode;
  readonly #soundType: SoundType;

  constructor(options: SoundOpts) {
    this.#loop = Boolean(options.loop);
    this.#soundType = options.soundType;
  }

  async play(): Promise<void> {
    this.#playId += 1;
    const playId = this.#playId;
    let soundBuffer = Sound.sounds.get(this.#soundType);

    if (!soundBuffer) {
      try {
        const src = Sound.getSrc(this.#soundType);
        const buffer = await Sound.loadSoundFile(src);
        const decodedBuffer = await this.#context.decodeAudioData(buffer);
        Sound.sounds.set(this.#soundType, decodedBuffer);
        soundBuffer = decodedBuffer;
      } catch (err) {
        log.error(`error: ${err}`);
        return;
      }
    }

    if (playId !== this.#playId) {
      return;
    }

    const soundNode = this.#context.createBufferSource();
    soundNode.buffer = soundBuffer;

    const volumeNode = this.#context.createGain();
    soundNode.connect(volumeNode);
    volumeNode.connect(this.#context.destination);

    if (isTestOrMockEnvironment()) {
      // Mute sounds in tests
      volumeNode.gain.setValueAtTime(0, this.#context.currentTime);
    }

    soundNode.loop = this.#loop;

    // Sounds can overlap, so keep the shared context running until all end.
    Sound.playing.add(soundNode);
    const release = () => {
      if (!Sound.playing.delete(soundNode)) {
        return;
      }
      soundNode.disconnect();
      volumeNode.disconnect();
      if (this.#node === soundNode) {
        this.#node = undefined;
      }
      if (Sound.playing.size === 0) {
        drop(Sound.suspend());
      }
    };
    soundNode.addEventListener('ended', release, { once: true });

    try {
      await this.#context.resume();
      // stop() may have been called while loading or resuming a ringtone.
      if (playId !== this.#playId) {
        release();
        return;
      }
      soundNode.start(0, 0);
      this.#node = soundNode;
    } catch (err) {
      release();
      throw err;
    }
  }

  stop(): void {
    this.#playId += 1;
    if (this.#node) {
      this.#node.stop(0);
      this.#node = undefined;
    }
  }

  private static async suspend(): Promise<void> {
    try {
      await Sound.context?.suspend();
    } catch (err) {
      log.error(`failed to suspend audio context: ${err}`);
    }
  }

  get #context(): AudioContext {
    if (!Sound.context) {
      // FIXME
      // oxlint-disable-next-line no-undef
      Sound.context = new AudioContext();
      // Decoding does not require the realtime audio rendering thread.
      drop(Sound.suspend());
    }
    return Sound.context;
  }

  static async loadSoundFile(src: string): Promise<ArrayBuffer> {
    // FIXME
    // oxlint-disable-next-line no-undef
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

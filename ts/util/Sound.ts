// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../logging/log';

export type SoundOpts = {
  loop?: boolean;
  src: string;
};

export class Sound {
  static sounds = new Map();

  private readonly context = new AudioContext();

  private readonly loop: boolean;

  private node?: AudioBufferSourceNode;

  private readonly src: string;

  constructor(options: SoundOpts) {
    this.loop = Boolean(options.loop);
    this.src = options.src;
  }

  async play(): Promise<void> {
    if (!Sound.sounds.has(this.src)) {
      try {
        const buffer = await Sound.loadSoundFile(this.src);
        const decodedBuffer = await this.context.decodeAudioData(buffer);
        Sound.sounds.set(this.src, decodedBuffer);
      } catch (err) {
        log.error(`Sound error: ${err}`);
        return;
      }
    }

    const soundBuffer = Sound.sounds.get(this.src);

    const soundNode = this.context.createBufferSource();
    soundNode.buffer = soundBuffer;

    const volumeNode = this.context.createGain();
    soundNode.connect(volumeNode);
    volumeNode.connect(this.context.destination);

    soundNode.loop = this.loop;

    soundNode.start(0, 0);

    this.node = soundNode;
  }

  stop(): void {
    if (this.node) {
      this.node.stop(0);
      this.node = undefined;
    }
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
}

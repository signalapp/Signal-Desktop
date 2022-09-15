// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { noop } from 'lodash';

/**
 * Wrapper around a global HTMLAudioElement that can update the
 * source and callbacks without requiring removeEventListener
 */
class GlobalMessageAudio {
  #audio: HTMLAudioElement = new Audio();

  #onLoadedMetadata = noop;
  #onTimeUpdate = noop;
  #onEnded = noop;
  #onDurationChange = noop;

  constructor() {
    // callbacks must be wrapped by function (not attached directly)
    // so changes to the callbacks are effected
    this.#audio.addEventListener('loadedmetadata', () =>
      this.#onLoadedMetadata()
    );
    this.#audio.addEventListener('timeupdate', () => this.#onTimeUpdate());
    this.#audio.addEventListener('durationchange', () =>
      this.#onDurationChange()
    );
    this.#audio.addEventListener('ended', () => this.#onEnded());
  }

  load({
    src,
    onLoadedMetadata,
    onTimeUpdate,
    onDurationChange,
    onEnded,
  }: {
    src: string;
    onLoadedMetadata: () => void;
    onTimeUpdate: () => void;
    onDurationChange: () => void;
    onEnded: () => void;
  }) {
    this.#audio.pause();
    this.#audio.currentTime = 0;

    // update callbacks
    this.#onLoadedMetadata = onLoadedMetadata;
    this.#onTimeUpdate = onTimeUpdate;
    this.#onDurationChange = onDurationChange;
    this.#onEnded = onEnded;

    this.#audio.src = src;
  }

  play(): Promise<void> {
    return this.#audio.play();
  }

  pause(): void {
    this.#audio.pause();
  }

  get playbackRate() {
    return this.#audio.playbackRate;
  }

  set playbackRate(rate: number) {
    this.#audio.playbackRate = rate;
  }

  get duration() {
    return this.#audio.duration;
  }

  get currentTime() {
    return this.#audio.currentTime;
  }

  set currentTime(value: number) {
    this.#audio.currentTime = value;
  }
}

export const globalMessageAudio = new GlobalMessageAudio();

// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import { isAbortError } from '../util/isAbortError.std.js';

const { noop } = lodash;

/**
 * Wrapper around a global HTMLAudioElement that can update the
 * source and callbacks without requiring removeEventListener
 */
class GlobalMessageAudio {
  #audio: HTMLAudioElement = new Audio();
  #url: string | undefined;

  // true immediately after play() is called, even if still loading
  #playing = false;

  #onLoadedMetadata = noop;
  #onTimeUpdate = noop;
  #onEnded = noop;
  #onDurationChange = noop;
  #onError = noop;

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
    url,
    playbackRate,
    onLoadedMetadata,
    onTimeUpdate,
    onDurationChange,
    onEnded,
    onError,
  }: {
    url: string;
    playbackRate: number;
    onLoadedMetadata: () => void;
    onTimeUpdate: () => void;
    onDurationChange: () => void;
    onEnded: () => void;
    onError: (error: unknown) => void;
  }) {
    this.#url = url;

    // update callbacks
    this.#onLoadedMetadata = onLoadedMetadata;
    this.#onTimeUpdate = onTimeUpdate;
    this.#onDurationChange = onDurationChange;
    this.#onEnded = onEnded;
    this.#onError = onError;

    // changing src resets the playback rate
    this.#audio.src = this.#url;
    this.#audio.playbackRate = playbackRate;
  }

  play(): void {
    this.#playing = true;
    this.#audio.play().catch(error => {
      // If `audio.pause()` is called before `audio.play()` resolves
      if (!isAbortError(error)) {
        this.#onError(error);
      }
    });
  }

  pause(): void {
    this.#audio.pause();
    this.#playing = false;
  }

  get playbackRate() {
    return this.#audio.playbackRate;
  }

  set playbackRate(rate: number) {
    this.#audio.playbackRate = rate;
  }

  get playing() {
    return this.#playing;
  }

  get url() {
    return this.#url;
  }

  get duration(): number | undefined {
    // the underlying Audio element can return NaN if the audio hasn't loaded
    // we filter out 0 or NaN as they are not useful values downstream
    return Number.isNaN(this.#audio.duration) || this.#audio.duration === 0
      ? undefined
      : this.#audio.duration;
  }

  get currentTime() {
    return this.#audio.currentTime;
  }

  set currentTime(value: number) {
    this.#audio.currentTime = value;
  }
}

export const globalMessageAudio = new GlobalMessageAudio();

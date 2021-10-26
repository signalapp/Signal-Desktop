// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import PQueue from 'p-queue';
import LRU from 'lru-cache';

import type { WaveformCache } from '../types/Audio';
import * as log from '../logging/log';

const MAX_WAVEFORM_COUNT = 1000;
const MAX_PARALLEL_COMPUTE = 8;
const MAX_AUDIO_DURATION = 15 * 60; // 15 minutes

export type ComputePeaksResult = {
  duration: number;
  peaks: ReadonlyArray<number>;
};

export type Contents = {
  audio: HTMLAudioElement;
  computePeaks(url: string, barCount: number): Promise<ComputePeaksResult>;
};

// This context's value is effectively global. This is not ideal but is necessary because
//   the app has multiple React roots. In the future, we should use a single React root
//   and instantiate these inside of `GlobalAudioProvider`. (We may wish to keep
//   `audioContext` global, however, as the browser limits the number that can be
//   created.)
const audioContext = new AudioContext();
audioContext.suspend();

const waveformCache: WaveformCache = new LRU({
  max: MAX_WAVEFORM_COUNT,
});

const inProgressMap = new Map<string, Promise<ComputePeaksResult>>();
const computeQueue = new PQueue({
  concurrency: MAX_PARALLEL_COMPUTE,
});

async function getAudioDuration(
  url: string,
  buffer: ArrayBuffer
): Promise<number> {
  const blob = new Blob([buffer]);
  const blobURL = URL.createObjectURL(blob);

  const audio = new Audio();
  audio.muted = true;
  audio.src = blobURL;

  await new Promise<void>((resolve, reject) => {
    audio.addEventListener('loadedmetadata', () => {
      resolve();
    });

    audio.addEventListener('error', event => {
      const error = new Error(
        `Failed to load audio from: ${url} due to error: ${event.type}`
      );
      reject(error);
    });
  });

  if (Number.isNaN(audio.duration)) {
    throw new Error(`Invalid audio duration for: ${url}`);
  }
  return audio.duration;
}

/**
 * Load audio from `url`, decode PCM data, and compute RMS peaks for displaying
 * the waveform.
 *
 * The results are cached in the `waveformCache` which is shared across
 * messages in the conversation and provided by GlobalAudioContext.
 *
 * The computation happens off the renderer thread by AudioContext, but it is
 * still quite expensive, so we cache it in the `waveformCache` LRU cache.
 */
async function doComputePeaks(
  url: string,
  barCount: number
): Promise<ComputePeaksResult> {
  const existing = waveformCache.get(url);
  if (existing) {
    log.info('GlobalAudioContext: waveform cache hit', url);
    return Promise.resolve(existing);
  }

  log.info('GlobalAudioContext: waveform cache miss', url);

  // Load and decode `url` into a raw PCM
  const response = await fetch(url);
  const raw = await response.arrayBuffer();

  const duration = await getAudioDuration(url, raw);

  const peaks = new Array(barCount).fill(0);
  if (duration > MAX_AUDIO_DURATION) {
    log.info(
      `GlobalAudioContext: audio ${url} duration ${duration}s is too long`
    );
    const emptyResult = { peaks, duration };
    waveformCache.set(url, emptyResult);
    return emptyResult;
  }

  const data = await audioContext.decodeAudioData(raw);

  // Compute RMS peaks
  const norms = new Array(barCount).fill(0);

  const samplesPerPeak = data.length / peaks.length;
  for (
    let channelNum = 0;
    channelNum < data.numberOfChannels;
    channelNum += 1
  ) {
    const channel = data.getChannelData(channelNum);

    for (let sample = 0; sample < channel.length; sample += 1) {
      const i = Math.floor(sample / samplesPerPeak);
      peaks[i] += channel[sample] ** 2;
      norms[i] += 1;
    }
  }

  // Average
  let max = 1e-23;
  for (let i = 0; i < peaks.length; i += 1) {
    peaks[i] = Math.sqrt(peaks[i] / Math.max(1, norms[i]));
    max = Math.max(max, peaks[i]);
  }

  // Normalize
  for (let i = 0; i < peaks.length; i += 1) {
    peaks[i] /= max;
  }

  const result = { peaks, duration };
  waveformCache.set(url, result);
  return result;
}

export async function computePeaks(
  url: string,
  barCount: number
): Promise<ComputePeaksResult> {
  const computeKey = `${url}:${barCount}`;

  const pending = inProgressMap.get(computeKey);
  if (pending) {
    log.info('GlobalAudioContext: already computing peaks for', computeKey);
    return pending;
  }

  log.info('GlobalAudioContext: queue computing peaks for', computeKey);
  const promise = computeQueue.add(() => doComputePeaks(url, barCount));

  inProgressMap.set(computeKey, promise);
  try {
    return await promise;
  } finally {
    inProgressMap.delete(computeKey);
  }
}

const globalContents: Contents = {
  audio: new Audio(),
  computePeaks,
};

export const GlobalAudioContext = React.createContext<Contents>(globalContents);

export type GlobalAudioProps = {
  conversationId: string | undefined;
  isPaused: boolean;
  children?: React.ReactNode | React.ReactChildren;
};

/**
 * A global context that holds Audio, AudioContext, LRU instances that are used
 * inside the conversation by ts/components/conversation/MessageAudio.tsx
 */
export const GlobalAudioProvider: React.FC<GlobalAudioProps> = ({
  conversationId,
  isPaused,
  children,
}) => {
  // When moving between conversations - stop audio
  React.useEffect(() => {
    return () => {
      globalContents.audio.pause();
    };
  }, [conversationId]);

  // Pause when requested by parent
  React.useEffect(() => {
    if (isPaused) {
      globalContents.audio.pause();
    }
  }, [isPaused]);

  return (
    <GlobalAudioContext.Provider value={globalContents}>
      {children}
    </GlobalAudioContext.Provider>
  );
};

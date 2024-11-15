// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import PQueue from 'p-queue';
import { LRUCache } from 'lru-cache';

import type { WaveformCache } from '../types/Audio';
import * as log from '../logging/log';
import { redactAttachmentUrl } from '../util/privacy';

const MAX_WAVEFORM_COUNT = 1000;
const MAX_PARALLEL_COMPUTE = 8;
const MAX_AUDIO_DURATION = 15 * 60; // 15 minutes

export type ComputePeaksResult = {
  duration: number;
  peaks: ReadonlyArray<number>; // 0 < peak < 1
};

export type Contents = {
  computePeaks(url: string, barCount: number): Promise<ComputePeaksResult>;
};

// This context's value is effectively global. This is not ideal but is necessary because
//   the app has multiple React roots. In the future, we should use a single React root
//   and instantiate these inside of `GlobalAudioProvider`. (We may wish to keep
//   `audioContext` global, however, as the browser limits the number that can be
//   created.)
let audioContext: AudioContext | undefined;

const waveformCache: WaveformCache = new LRUCache({
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
  const urlForLogging = redactAttachmentUrl(url);
  const audio = new Audio();
  audio.muted = true;
  audio.src = blobURL;

  await new Promise<void>((resolve, reject) => {
    audio.addEventListener('loadedmetadata', () => {
      resolve();
    });

    audio.addEventListener('error', event => {
      const error = new Error(
        `Failed to load audio from: ${urlForLogging} due to error: ${event.type}`
      );
      reject(error);
    });
  });

  if (Number.isNaN(audio.duration)) {
    throw new Error(`Invalid audio duration for: ${urlForLogging}`);
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
  const cacheKey = `${url}:${barCount}`;
  const existing = waveformCache.get(cacheKey);
  const urlForLogging = redactAttachmentUrl(url);

  const logId = `GlobalAudioContext(${urlForLogging})`;
  if (existing) {
    log.info(`${logId}: waveform cache hit`);
    return Promise.resolve(existing);
  }

  log.info(`${logId}: waveform cache miss`);

  // Load and decode `url` into a raw PCM
  const response = await fetch(url);
  const raw = await response.arrayBuffer();

  const duration = await getAudioDuration(url, raw);

  const peaks = new Array(barCount).fill(0);
  if (duration > MAX_AUDIO_DURATION) {
    log.info(`${logId}: duration ${duration}s is too long`);
    const emptyResult = { peaks, duration };
    waveformCache.set(cacheKey, emptyResult);
    return emptyResult;
  }

  if (!audioContext) {
    audioContext = new AudioContext();
    await audioContext.suspend();
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
  waveformCache.set(cacheKey, result);
  return result;
}

export async function computePeaks(
  url: string,
  barCount: number
): Promise<ComputePeaksResult> {
  const computeKey = `${url}:${barCount}`;
  const logId = `VoiceNotesPlaybackContext(${redactAttachmentUrl(url)})`;

  const pending = inProgressMap.get(computeKey);
  if (pending) {
    log.info(`${logId}: already computing peaks`);
    return pending;
  }

  log.info(`${logId}: queueing computing peaks`);
  const promise = computeQueue.add(() => doComputePeaks(url, barCount));

  inProgressMap.set(computeKey, promise);
  try {
    return await promise;
  } finally {
    inProgressMap.delete(computeKey);
  }
}

const globalContents: Contents = {
  computePeaks,
};

export const VoiceNotesPlaybackContext =
  React.createContext<Contents>(globalContents);

export type VoiceNotesPlaybackProps = {
  children?: React.ReactNode | React.ReactChildren;
};

/**
 * A global context that holds Audio, AudioContext, LRU instances that are used
 * inside the conversation by ts/components/conversation/MessageAudio.tsx
 */
export function VoiceNotesPlaybackProvider({
  children,
}: VoiceNotesPlaybackProps): JSX.Element {
  return (
    <VoiceNotesPlaybackContext.Provider value={globalContents}>
      {children}
    </VoiceNotesPlaybackContext.Provider>
  );
}

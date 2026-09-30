// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createContext, type ReactNode, type JSX } from 'react';
import PQueue from 'p-queue';
import { LRUCache } from 'lru-cache';

import type { WaveformCache } from '../types/Audio.dom.tsx';
import { WaveformBuilder } from '../util/waveformBuilder.std.ts';
import { createLogger } from '../logging/log.std.ts';

const log = createLogger('VoiceNotesPlaybackContext');

const MAX_WAVEFORM_COUNT = 1000;
const MAX_PARALLEL_COMPUTE = 8;
const MAX_AUDIO_DURATION = 15 * 60; // 15 minutes

export type ComputeWaveformResult = {
  duration: number;
  waveform: ReadonlyArray<number>;
};

export type Contents = {
  computeWaveform: (url: string) => Promise<ComputeWaveformResult>;
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

const inProgressMap = new Map<string, Promise<ComputeWaveformResult>>();
const computeQueue = new PQueue({
  concurrency: MAX_PARALLEL_COMPUTE,
});

async function getAudioDuration(buffer: ArrayBuffer): Promise<number> {
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
        `Failed to load audio from due to error: ${event.type}`
      );
      reject(error);
    });
  });

  if (Number.isNaN(audio.duration)) {
    throw new Error('Invalid audio duration');
  }
  return audio.duration;
}

/**
 * Load audio from `url`, decode PCM data, and compute waveform for displaying
 * the waveform.
 *
 * The results are cached in the `waveformCache` which is shared across
 * messages in the conversation and provided by GlobalAudioContext.
 *
 * The computation happens off the renderer thread by AudioContext, but it is
 * still quite expensive, so we cache it in the `waveformCache` LRU cache.
 */
async function doComputeWaveform(url: string): Promise<ComputeWaveformResult> {
  const cacheKey = url;
  const existing = waveformCache.get(cacheKey);

  const logId = 'GlobalAudioContext';
  if (existing) {
    log.info(`${logId}: waveform cache hit`);
    return Promise.resolve(existing);
  }

  log.info(`${logId}: waveform cache miss`);

  // Load and decode `url` into a raw PCM
  const response = await fetch(url);
  const raw = await response.arrayBuffer();

  const duration = await getAudioDuration(raw);

  if (duration > MAX_AUDIO_DURATION) {
    log.info(`${logId}: duration ${duration}s is too long`);
    const emptyResult = { waveform: [], duration };
    waveformCache.set(cacheKey, emptyResult);
    return emptyResult;
  }

  if (!audioContext) {
    audioContext = new AudioContext();
    await audioContext.suspend();
  }

  const data = await audioContext.decodeAudioData(raw);
  const waveformBuilder = new WaveformBuilder();

  const channels = new Array<Float32Array>();
  let maxSamples = 0;
  for (
    let channelNum = 0;
    channelNum < data.numberOfChannels;
    channelNum += 1
  ) {
    const channel = data.getChannelData(channelNum);
    maxSamples = Math.max(maxSamples, channel.length);
    channels.push(channel);
  }

  // Interleave samples from each channel
  for (let t = 0; t < maxSamples; t += 1) {
    for (const channel of channels) {
      waveformBuilder.push(channel[t] ?? 0);
    }
  }

  const result = { waveform: waveformBuilder.collect(), duration };
  waveformCache.set(cacheKey, result);
  return result;
}

export async function computeWaveform(
  url: string
): Promise<ComputeWaveformResult> {
  const computeKey = url;
  const logId = 'VoiceNotesPlaybackContext';

  const pending = inProgressMap.get(computeKey);
  if (pending) {
    log.info(`${logId}: already computing waveform`);
    return pending;
  }

  log.info(`${logId}: queueing computing waveform`);
  const promise = computeQueue.add(() => doComputeWaveform(url));

  inProgressMap.set(computeKey, promise);
  try {
    return await promise;
  } finally {
    inProgressMap.delete(computeKey);
  }
}

const globalContents: Contents = {
  computeWaveform,
};

export const VoiceNotesPlaybackContext =
  createContext<Contents>(globalContents);

export type VoiceNotesPlaybackProps = {
  children?: ReactNode;
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

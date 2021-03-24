// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import LRU from 'lru-cache';

import { WaveformCache } from '../types/Audio';

const MAX_WAVEFORM_COUNT = 1000;

type Contents = {
  audio: HTMLAudioElement;
  audioContext: AudioContext;
  waveformCache: WaveformCache;
};

// This context's value is effectively global. This is not ideal but is necessary because
//   the app has multiple React roots. In the future, we should use a single React root
//   and instantiate these inside of `GlobalAudioProvider`. (We may wish to keep
//   `audioContext` global, however, as the browser limits the number that can be
//   created.)
const globalContents: Contents = {
  audio: new Audio(),
  audioContext: new AudioContext(),
  waveformCache: new LRU({
    max: MAX_WAVEFORM_COUNT,
  }),
};

export const GlobalAudioContext = React.createContext<Contents>(globalContents);

export type GlobalAudioProps = {
  conversationId: string;
  children?: React.ReactNode | React.ReactChildren;
};

/**
 * A global context that holds Audio, AudioContext, LRU instances that are used
 * inside the conversation by ts/components/conversation/MessageAudio.tsx
 */
export const GlobalAudioProvider: React.FC<GlobalAudioProps> = ({
  conversationId,
  children,
}) => {
  // When moving between conversations - stop audio
  React.useEffect(() => {
    return () => {
      globalContents.audio.pause();
    };
  }, [conversationId]);

  return (
    <GlobalAudioContext.Provider value={globalContents}>
      {children}
    </GlobalAudioContext.Provider>
  );
};

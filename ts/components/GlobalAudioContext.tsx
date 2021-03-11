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

export const GlobalAudioContext = React.createContext<Contents | null>(null);

export type GlobalAudioProps = {
  conversationId: string;
  children?: React.ReactNode | React.ReactChildren;
};

const audioContext = new AudioContext();

/**
 * A global context that holds Audio, AudioContext, LRU instances that are used
 * inside the conversation by ts/components/conversation/MessageAudio.tsx
 */
export const GlobalAudioProvider: React.FC<GlobalAudioProps> = ({
  conversationId,
  children,
}) => {
  const audio = React.useRef<HTMLAudioElement | null>(null);
  const waveformCache = React.useRef<WaveformCache | null>(null);

  // NOTE: We don't want to construct these values on every re-render hence
  // the constructor calls have to be guarded by `if`s.
  if (!audio.current) {
    audio.current = new Audio();
  }
  if (!waveformCache.current) {
    waveformCache.current = new LRU({
      max: MAX_WAVEFORM_COUNT,
    });
  }

  // When moving between conversations - stop audio
  React.useEffect(() => {
    return () => {
      if (audio.current) {
        audio.current.pause();
      }
    };
  }, [conversationId]);

  const value = {
    audio: audio.current,
    audioContext,
    waveformCache: waveformCache.current,
  };

  return (
    <GlobalAudioContext.Provider value={value}>
      {children}
    </GlobalAudioContext.Provider>
  );
};

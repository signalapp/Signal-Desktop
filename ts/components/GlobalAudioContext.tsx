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

/**
 * A global context that holds Audio, AudioContext, LRU instances that are used
 * inside the conversation by ts/components/conversation/MessageAudio.tsx
 */
export const GlobalAudioProvider: React.FC<GlobalAudioProps> = ({
  conversationId,
  children,
}) => {
  const audio = React.useMemo(() => {
    window.log.info(
      'GlobalAudioProvider: re-generating audio for',
      conversationId
    );
    return new Audio();
  }, [conversationId]);

  // NOTE: the number of active audio contexts is limited per tab/window
  // See: https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/AudioContext#google_chrome
  const audioContext = React.useMemo(() => {
    window.log.info('Instantiating new audio context');
    return new AudioContext();
  }, []);

  const waveformCache: WaveformCache = React.useMemo(() => {
    return new LRU({
      max: MAX_WAVEFORM_COUNT,
    });
  }, []);

  // When moving between conversations - stop audio
  React.useEffect(() => {
    return () => {
      audio.pause();
    };
  }, [audio, conversationId]);

  React.useEffect(() => {
    return () => {
      window.log.info('Closing old audio context');
      audioContext.close();
    };
  }, [audioContext]);

  const value = {
    audio,
    audioContext,
    waveformCache,
  };

  return (
    <GlobalAudioContext.Provider value={value}>
      {children}
    </GlobalAudioContext.Provider>
  );
};

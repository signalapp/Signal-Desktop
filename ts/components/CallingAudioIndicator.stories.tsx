// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, useEffect } from 'react';
import { boolean } from '@storybook/addon-knobs';

import {
  CallingAudioIndicator,
  SPEAKING_LINGER_MS,
} from './CallingAudioIndicator';
import { AUDIO_LEVEL_INTERVAL_MS } from '../calling/constants';
import { useValueAtFixedRate } from '../hooks/useValueAtFixedRate';

export default {
  title: 'Components/CallingAudioIndicator',
};

export function Extreme(): JSX.Element {
  const [audioLevel, setAudioLevel] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAudioLevel(1 - audioLevel);
    }, 2 * AUDIO_LEVEL_INTERVAL_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [audioLevel, setAudioLevel]);

  const isSpeaking = useValueAtFixedRate(audioLevel > 0, SPEAKING_LINGER_MS);

  return (
    <CallingAudioIndicator
      hasAudio={boolean('hasAudio', true)}
      audioLevel={audioLevel}
      shouldShowSpeaking={isSpeaking}
    />
  );
}

export function Random(): JSX.Element {
  const [audioLevel, setAudioLevel] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAudioLevel(Math.random());
    }, AUDIO_LEVEL_INTERVAL_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [audioLevel, setAudioLevel]);

  const isSpeaking = useValueAtFixedRate(audioLevel > 0, SPEAKING_LINGER_MS);

  return (
    <CallingAudioIndicator
      hasAudio={boolean('hasAudio', true)}
      audioLevel={audioLevel}
      shouldShowSpeaking={isSpeaking}
    />
  );
}

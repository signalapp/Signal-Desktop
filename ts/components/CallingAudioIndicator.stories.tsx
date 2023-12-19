// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, useEffect } from 'react';
import type { Meta } from '@storybook/react';
import type { Props } from './CallingAudioIndicator';
import {
  CallingAudioIndicator,
  SPEAKING_LINGER_MS,
} from './CallingAudioIndicator';
import { AUDIO_LEVEL_INTERVAL_MS } from '../calling/constants';
import { useValueAtFixedRate } from '../hooks/useValueAtFixedRate';

export default {
  title: 'Components/CallingAudioIndicator',
  component: CallingAudioIndicator,
  argTypes: {
    hasAudio: {
      control: { type: 'boolean' },
    },
  },
  args: {
    hasAudio: true,
  },
} satisfies Meta<Props>;

export function Extreme(args: Props): JSX.Element {
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
      hasAudio={args.hasAudio}
      audioLevel={audioLevel}
      shouldShowSpeaking={isSpeaking}
    />
  );
}

export function Random(args: Props): JSX.Element {
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
      hasAudio={args.hasAudio}
      audioLevel={audioLevel}
      shouldShowSpeaking={isSpeaking}
    />
  );
}

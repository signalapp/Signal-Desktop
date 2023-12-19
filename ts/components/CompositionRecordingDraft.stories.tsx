// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { Props } from './CompositionRecordingDraft';
import { CompositionRecordingDraft } from './CompositionRecordingDraft';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'components/CompositionRecordingDraft',
  component: CompositionRecordingDraft,
} satisfies Meta<Props>;

export function Default(): JSX.Element {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = React.useState<number>(0);
  const [duration, setDuration] = React.useState<number | undefined>(undefined);

  const audio = React.useMemo(() => {
    const a = new Audio();

    a.addEventListener('loadedmetadata', () => {
      setDuration(duration);
    });

    a.src = '/fixtures/incompetech-com-Agnus-Dei-X.mp3';

    a.addEventListener('timeupdate', () => {
      setCurrentTime(a.currentTime);
    });

    a.addEventListener('ended', () => {
      setIsPlaying(false);
      setCurrentTime(0);
    });

    a.addEventListener('loadeddata', () => {
      a.currentTime = currentTime;
    });

    return a;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePlay = (positionAsRatio?: number) => {
    if (positionAsRatio !== undefined) {
      audio.currentTime = positionAsRatio * audio.duration;
    }
    void audio.play();
    setCurrentTime(audio.currentTime);
    setIsPlaying(true);
  };

  const handlePause = () => {
    audio.pause();
    setIsPlaying(false);
  };

  const handleScrub = (newPosition: number) => {
    if (duration !== undefined) {
      audio.currentTime = newPosition * duration;
    }
  };

  return (
    <CompositionRecordingDraft
      i18n={i18n}
      audioUrl={audio.src}
      active={{
        playing: isPlaying,
        currentTime,
        duration,
      }}
      onCancel={action('cancel')}
      onSend={action('send')}
      onPlay={handlePlay}
      onPause={handlePause}
      onScrub={handleScrub}
    />
  );
}

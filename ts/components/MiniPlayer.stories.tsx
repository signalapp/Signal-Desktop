// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useState } from 'react';
import type { Meta } from '@storybook/react';
import type { Props } from './MiniPlayer';
import { MiniPlayer, PlayerState } from './MiniPlayer';

import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const audio = new Audio();
audio.src = '/fixtures/incompetech-com-Agnus-Dei-X.mp3';

export default {
  title: 'components/MiniPlayer',
  component: MiniPlayer,
} satisfies Meta<Props>;

export function Default(): JSX.Element {
  const [active, setActive] = useState(false);

  const [playerState, setPlayerState] = useState(PlayerState.loading);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);

  const activate = () => {
    setActive(true);

    setTimeout(() => {
      setPlayerState(PlayerState.playing);
      void audio.play();
    }, 2000);
  };

  const deactivate = () => {
    setActive(false);
    setPlayerState(PlayerState.loading);
    audio.pause();
    audio.currentTime = 0;
  };

  useEffect(() => {
    const handleUpdateTime = () => {
      setCurrentTime(audio.currentTime);
    };
    const handleEnded = () => {
      deactivate();
    };
    audio.addEventListener('timeupdate', handleUpdateTime);
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('timeupdate', handleUpdateTime);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [setCurrentTime]);

  const playAction = () => {
    setPlayerState(PlayerState.playing);
    void audio.play();
  };
  const pauseAction = () => {
    setPlayerState(PlayerState.paused);
    audio.pause();
  };

  const setPlaybackRateAction = (rate: number) => {
    setPlaybackRate(rate);
    audio.playbackRate = rate;
  };

  return (
    <>
      {active && (
        <MiniPlayer
          title="Paige Hall 😉"
          i18n={i18n}
          onPlay={playAction}
          onPause={pauseAction}
          onPlaybackRate={setPlaybackRateAction}
          state={playerState}
          currentTime={currentTime}
          duration={Number.isFinite(audio.duration) ? audio.duration : 0}
          playbackRate={playbackRate}
          onClose={deactivate}
        />
      )}

      {!active && (
        <button type="button" onClick={activate}>
          Activate
        </button>
      )}
    </>
  );
}

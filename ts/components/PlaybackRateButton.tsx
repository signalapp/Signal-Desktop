// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import classNames from 'classnames';
import React, { useCallback, useState } from 'react';
import { animated, useSpring } from '@react-spring/web';
import type { LocalizerType } from '../types/Util';
import { useReducedMotion } from '../hooks/useReducedMotion';

const SPRING_CONFIG = {
  mass: 0.5,
  tension: 350,
  friction: 20,
  velocity: 0.01,
};

type Props = {
  // undefined if not playing
  playbackRate: number | undefined;
  variant: 'message-outgoing' | 'message-incoming' | 'mini-player';
  onClick: () => void;
  visible?: boolean;
  i18n: LocalizerType;
};

export function PlaybackRateButton({
  playbackRate,
  variant,
  visible = true,
  i18n,
  onClick,
}: Props): JSX.Element {
  const [isDown, setIsDown] = useState(false);
  const reducedMotion = useReducedMotion();

  // eslint-disable-next-line react-hooks/exhaustive-deps -- FIXME
  const [animProps] = useSpring(
    {
      immediate: reducedMotion,
      config: SPRING_CONFIG,
      to: isDown ? { scale: 1.3 } : { scale: visible ? 1 : 0 },
    },
    [visible, isDown]
  );

  // Clicking button toggle playback
  const onButtonClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();

      onClick();
    },
    [onClick]
  );

  // Keyboard playback toggle
  const onButtonKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== 'Space') {
        return;
      }
      event.stopPropagation();
      event.preventDefault();

      onClick();
    },
    [onClick]
  );

  const playbackRateLabels: { [key: number]: string } = {
    1: i18n('icu:MessageAudio--playbackRate1'),
    1.5: i18n('icu:MessageAudio--playbackRate1p5'),
    2: i18n('icu:MessageAudio--playbackRate2'),
    0.5: i18n('icu:MessageAudio--playbackRatep5'),
  };

  const label = playbackRate
    ? playbackRateLabels[playbackRate].toString()
    : undefined;

  return (
    <animated.div style={animProps}>
      <button
        type="button"
        className={classNames(
          'PlaybackRateButton',
          `PlaybackRateButton--${variant}`
        )}
        onClick={onButtonClick}
        onKeyDown={onButtonKeyDown}
        onMouseDown={() => setIsDown(true)}
        onMouseUp={() => setIsDown(false)}
        onMouseLeave={() => setIsDown(false)}
        aria-label={label}
        tabIndex={0}
      >
        {label}
      </button>
    </animated.div>
  );
}

const playbackRates = [1, 1.5, 2, 0.5];

PlaybackRateButton.nextPlaybackRate = (currentRate: number): number => {
  // cycle through the rates
  return playbackRates[
    (playbackRates.indexOf(currentRate) + 1) % playbackRates.length
  ];
};

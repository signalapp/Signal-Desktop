// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import classNames from 'classnames';
import { noop } from 'lodash';
import type { ReactElement } from 'react';
import React, { useEffect, useCallback, useState } from 'react';
import { useSpring, animated } from '@react-spring/web';

import { AUDIO_LEVEL_INTERVAL_MS } from '../calling/constants';
import { missingCaseError } from '../util/missingCaseError';

const SPEAKING_LINGER_MS = 500;

const BASE_CLASS_NAME = 'CallingAudioIndicator';
const CONTENT_CLASS_NAME = `${BASE_CLASS_NAME}__content`;

const MIN_BAR_HEIGHT = 2;
const SIDE_SCALE_FACTOR = 0.75;
const MAX_CENTRAL_BAR_DELTA = 9;

/* Should match css */
const CONTENT_WIDTH = 14;
const CONTENT_HEIGHT = 14;
const BAR_WIDTH = 2;

const CONTENT_PADDING = 1;

enum BarPosition {
  Left,
  Center,
  Right,
}

function generateBarPath(position: BarPosition, audioLevel: number): string {
  let x: number;
  if (position === BarPosition.Left) {
    x = CONTENT_PADDING;
  } else if (position === BarPosition.Center) {
    x = CONTENT_WIDTH / 2 - CONTENT_PADDING;
  } else if (position === BarPosition.Right) {
    x = CONTENT_WIDTH - CONTENT_PADDING - BAR_WIDTH;
  } else {
    throw missingCaseError(position);
  }

  let height: number;
  if (position === BarPosition.Left || position === BarPosition.Right) {
    height =
      MIN_BAR_HEIGHT + audioLevel * MAX_CENTRAL_BAR_DELTA * SIDE_SCALE_FACTOR;
  } else if (position === BarPosition.Center) {
    height = MIN_BAR_HEIGHT + audioLevel * MAX_CENTRAL_BAR_DELTA;
  } else {
    throw missingCaseError(position);
  }

  // Take the round corners off the height
  height -= 2;

  const y = (CONTENT_HEIGHT - height) / 2;
  const top = y;
  const bottom = top + height;

  return (
    `M ${x} ${top} ` +
    `L ${x} ${bottom} ` +
    `A 0.5 0.5 0 0 0 ${x + BAR_WIDTH} ${bottom} ` +
    `L ${x + BAR_WIDTH} ${top} ` +
    `A 0.5 0.5 0 0 0 ${x} ${top}`
  );
}

function Bar({
  position,
  audioLevel,
}: {
  position: BarPosition;
  audioLevel: number;
}): ReactElement {
  const animatedProps = useSpring({
    from: { audioLevel: 0 },
    config: { duration: AUDIO_LEVEL_INTERVAL_MS },
  });

  const levelToPath = useCallback(
    (animatedLevel: number): string => {
      return generateBarPath(position, animatedLevel);
    },
    [position]
  );

  useEffect(() => {
    animatedProps.audioLevel.stop();
    animatedProps.audioLevel.start(audioLevel);
  }, [audioLevel, animatedProps]);

  return (
    <animated.path
      d={animatedProps.audioLevel.to(levelToPath)}
      fill="#ffffff"
    />
  );
}

export function CallingAudioIndicator({
  hasAudio,
  audioLevel,
}: Readonly<{ hasAudio: boolean; audioLevel: number }>): ReactElement {
  const [shouldShowSpeaking, setShouldShowSpeaking] = useState(audioLevel > 0);

  useEffect(() => {
    if (audioLevel > 0) {
      setShouldShowSpeaking(true);
    } else if (shouldShowSpeaking) {
      const timeout = setTimeout(() => {
        setShouldShowSpeaking(false);
      }, SPEAKING_LINGER_MS);
      return () => {
        clearTimeout(timeout);
      };
    }
    return noop;
  }, [audioLevel, shouldShowSpeaking]);

  if (!hasAudio) {
    return (
      <div
        className={classNames(
          BASE_CLASS_NAME,
          `${BASE_CLASS_NAME}--with-content`
        )}
      >
        <div
          className={classNames(
            CONTENT_CLASS_NAME,
            `${CONTENT_CLASS_NAME}--muted`
          )}
        />
      </div>
    );
  }

  if (shouldShowSpeaking) {
    return (
      <div
        className={classNames(
          BASE_CLASS_NAME,
          `${BASE_CLASS_NAME}--with-content`
        )}
      >
        <svg className={CONTENT_CLASS_NAME}>
          <Bar position={BarPosition.Left} audioLevel={audioLevel} />
          <Bar position={BarPosition.Center} audioLevel={audioLevel} />
          <Bar position={BarPosition.Right} audioLevel={audioLevel} />
        </svg>
      </div>
    );
  }

  // Render an empty spacer so that names don't move around.
  return <div className={BASE_CLASS_NAME} />;
}

// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import classNames from 'classnames';
import type { ReactElement } from 'react';
import React, { useEffect } from 'react';
import { useSpring, animated } from '@react-spring/web';

import { AUDIO_LEVEL_INTERVAL_MS } from '../calling/constants';
import { missingCaseError } from '../util/missingCaseError';

export const SPEAKING_LINGER_MS = 200;
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
    x = CONTENT_WIDTH / 2 - BAR_WIDTH / 2;
  } else if (position === BarPosition.Right) {
    x = CONTENT_WIDTH - CONTENT_PADDING - BAR_WIDTH;
  } else {
    throw missingCaseError(position);
  }

  x = Math.round(x);

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
  const left = x;
  const right = x + BAR_WIDTH;
  const top = y.toFixed(2);
  const bottom = (y + height).toFixed(2);

  return (
    `M ${left} ${top} ` +
    `L ${left} ${bottom} ` +
    `A 0.5 0.5 0 0 0 ${right} ${bottom} ` +
    `L ${right} ${top} ` +
    `A 0.5 0.5 0 0 0 ${left} ${top}`
  );
}

function generateCombinedPath(audioLevel: number): string {
  return (
    `${generateBarPath(BarPosition.Left, audioLevel)} ` +
    `${generateBarPath(BarPosition.Center, audioLevel)} ` +
    `${generateBarPath(BarPosition.Right, audioLevel)} `
  );
}

function Bars({ audioLevel }: { audioLevel: number }): ReactElement {
  const animatedProps = useSpring({
    from: { audioLevel: 0 },
    config: { duration: AUDIO_LEVEL_INTERVAL_MS },
  });

  useEffect(() => {
    animatedProps.audioLevel.stop();
    void animatedProps.audioLevel.start(audioLevel);
  }, [audioLevel, animatedProps]);

  return (
    <animated.path
      d={animatedProps.audioLevel.to(generateCombinedPath)}
      fill="#ffffff"
    />
  );
}

export type Props = Readonly<{
  hasAudio: boolean;
  audioLevel: number;
  shouldShowSpeaking: boolean;
}>;

export function CallingAudioIndicator({
  hasAudio,
  audioLevel,
  shouldShowSpeaking,
}: Props): ReactElement {
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
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={CONTENT_CLASS_NAME}
          viewBox={`0 0 ${CONTENT_WIDTH} ${CONTENT_HEIGHT}`}
          width={CONTENT_WIDTH}
          height={CONTENT_HEIGHT}
          style={{ transform: 'translate3d(0px, 0px, 0px)' }}
        >
          <Bars audioLevel={audioLevel} />
        </svg>
      </div>
    );
  }

  // Render an empty spacer so that names don't move around.
  return <div className={BASE_CLASS_NAME} />;
}

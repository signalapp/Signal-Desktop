// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { animated, to as interpolate, useSprings } from '@react-spring/web';
import { random } from 'lodash';
import { Emojify } from './conversation/Emojify';
import { useReducedMotion } from '../hooks/useReducedMotion';

export type PropsType = {
  emoji: string;
  onAnimationEnd: () => unknown;
  rotate?: number;
  scale?: number;
  x?: number;
};

const NUM_EMOJIS = 16;
const MAX_HEIGHT = 1280;

const to = (i: number, f: () => unknown) => ({
  delay: i * random(80, 120),
  rotate: random(-24, 24),
  scale: random(0.5, 1.0, true),
  y: -144,
  onRest: i === NUM_EMOJIS - 1 ? f : undefined,
});
const from = (_i: number) => ({
  rotate: 0,
  scale: 1,
  y: MAX_HEIGHT,
});

function transform(y: number, scale: number, rotate: number): string {
  return `translateY(${y}px) scale(${scale}) rotate(${rotate}deg)`;
}

export function AnimatedEmojiGalore({
  emoji,
  onAnimationEnd,
}: PropsType): JSX.Element {
  const reducedMotion = useReducedMotion();
  const [springs] = useSprings(NUM_EMOJIS, i => ({
    ...to(i, onAnimationEnd),
    from: from(i),
    immediate: reducedMotion,
    config: {
      mass: 20,
      tension: 120,
      friction: 80,
      clamp: true,
    },
  }));

  return (
    <>
      {springs.map((styles, index) => (
        <animated.div
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          style={{
            left: `${random(0, 100)}%`,
            position: 'absolute',
            transform: interpolate(
              [styles.y, styles.scale, styles.rotate],
              transform
            ),
          }}
        >
          <Emojify sizeClass="extra-large" text={emoji} />
        </animated.div>
      ))}
    </>
  );
}

// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { animated, to as interpolate, useSprings } from '@react-spring/web';
import lodash from 'lodash';
import { useReducedMotion } from '../hooks/useReducedMotion.dom.js';
import { FunStaticEmoji } from './fun/FunEmoji.dom.js';
import { strictAssert } from '../util/assert.std.js';
import {
  getEmojiVariantByKey,
  getEmojiVariantKeyByValue,
  isEmojiVariantValue,
} from './fun/data/emojis.std.js';

const { random } = lodash;

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
  strictAssert(isEmojiVariantValue(emoji), 'Must be valid english short name');
  const emojiVariantKey = getEmojiVariantKeyByValue(emoji);
  const emojiVariant = getEmojiVariantByKey(emojiVariantKey);

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
          <FunStaticEmoji size={48} emoji={emojiVariant} role="presentation" />
        </animated.div>
      ))}
    </>
  );
}

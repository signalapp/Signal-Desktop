// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { animated, useSpring } from '@react-spring/web';
import { random } from 'lodash';
import { v4 as uuid } from 'uuid';
import { Emojify } from './conversation/Emojify';
import { useReducedMotion } from '../hooks/useReducedMotion';

export type PropsType = {
  values: Array<string>;
  onAnimationEnd?: () => unknown;
};

const NUM_EMOJIS = 6;
const DELAY_BETWEEN_EMOJIS = 120;
const EMOJI_HEIGHT = 36;

type AnimationConfig = {
  mass: number;
  tension: number;
  friction: number;
  clamp: boolean;
  precision: number;
  velocity: number;
};

// values is an array of emojis, which is useful when bursting multi skin tone set of
// emojis to get the correct representation
export function CallReactionBurstEmoji({ values }: PropsType): JSX.Element {
  const [toY, setToY] = React.useState<number>(0);
  const fromY = -50;

  const generateEmojiProps = React.useCallback(
    (index: number) => {
      return {
        key: uuid(),
        value: values[index % values.length],
        springConfig: {
          mass: random(10, 20),
          tension: random(45, 60),
          friction: random(20, 60),
          clamp: true,
          precision: 0,
          velocity: -0.01,
        },
        fromX: random(0, 20),
        toX: random(-30, 300),
        fromY,
        toY,
        toScale: random(1, 2.5, true),
        fromRotate: random(-45, 45),
        toRotate: random(-45, 45),
      };
    },
    [fromY, toY, values]
  );

  // Calculate target Y position before first render. Emojis need to animate Y upwards
  // by the value of the container's top, plus the emoji's maximum height.
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  React.useLayoutEffect(() => {
    if (containerRef.current) {
      const { top } = containerRef.current.getBoundingClientRect();
      const calculatedToY = -top;
      setToY(calculatedToY);
      setEmojis([{ ...generateEmojiProps(0), toY: calculatedToY }]);
    }
  }, [generateEmojiProps]);

  const [emojis, setEmojis] = React.useState<Array<AnimatedEmojiProps>>([
    generateEmojiProps(0),
  ]);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setEmojis(curEmojis => {
        const emojiCount = curEmojis.length;
        if (emojiCount + 1 >= NUM_EMOJIS) {
          clearInterval(timer);
        }
        return [...curEmojis, generateEmojiProps(emojiCount)];
      });
    }, DELAY_BETWEEN_EMOJIS);

    return () => {
      clearInterval(timer);
    };
  }, [fromY, toY, values, generateEmojiProps]);

  return (
    <div className="CallReactionBurstEmoji" ref={containerRef}>
      {emojis.map(props => (
        <AnimatedEmoji {...props} />
      ))}
    </div>
  );
}

type AnimatedEmojiProps = {
  value: string;
  fromRotate: number;
  fromX: number;
  fromY: number;
  toRotate: number;
  toScale: number;
  toX: number;
  toY: number;
  springConfig: AnimationConfig;
  onAnimationEnd?: () => unknown;
};

export function AnimatedEmoji({
  value,
  fromRotate,
  fromX,
  fromY,
  toRotate,
  toScale,
  toX,
  toY,
  springConfig,
  onAnimationEnd,
}: AnimatedEmojiProps): JSX.Element {
  const height = EMOJI_HEIGHT * toScale;

  const reducedMotion = useReducedMotion();
  const { rotate, x, y } = useSpring({
    immediate: reducedMotion,
    from: {
      rotate: fromRotate,
      x: fromX,
      y: fromY,
    },
    to: {
      rotate: toRotate,
      x: toX,
      y: toY - height - 10,
    },
    config: springConfig,
    onRest: onAnimationEnd,
  });

  // These styles animate faster than Y.
  // Reactions toasts animate with opacity so harmonize with that.
  const { scale } = useSpring({
    immediate: reducedMotion,
    from: {
      scale: 0.5,
    },
    to: {
      scale: toScale,
    },
  });

  return (
    <animated.div
      className="CallReactionBurstEmoji"
      style={{
        rotate,
        scale,
        x,
        y,
      }}
    >
      <Emojify sizeClass="medium" text={value} />
    </animated.div>
  );
}

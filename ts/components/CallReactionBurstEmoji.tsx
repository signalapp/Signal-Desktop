// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { animated, useSpring } from '@react-spring/web';
import { random } from 'lodash';
import { v4 as uuid } from 'uuid';
import { Emojify } from './conversation/Emojify';

export type PropsType = {
  value: string;
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

export function CallReactionBurstEmoji({ value }: PropsType): JSX.Element {
  const [toY, setToY] = React.useState<number>(0);
  const fromY = -50;

  const generateEmojiProps = React.useCallback(() => {
    return {
      key: uuid(),
      value,
      springConfig: {
        mass: random(10, 20),
        tension: random(60, 90),
        friction: random(20, 60),
        clamp: true,
        precision: 0,
        velocity: -0.01,
      },
      fromY,
      toY,
      toScale: random(1, 2.5, true),
      fromRotate: random(-45, 45),
      toRotate: random(-45, 45),
    };
  }, [fromY, toY, value]);

  // Calculate target Y position before first render. Emojis need to animate Y upwards
  // by the value of the container's top, plus the emoji's maximum height.
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  React.useLayoutEffect(() => {
    if (containerRef.current) {
      const { top } = containerRef.current.getBoundingClientRect();
      const calculatedToY = -top;
      setToY(calculatedToY);
      setEmojis([{ ...generateEmojiProps(), toY: calculatedToY }]);
    }
  }, [generateEmojiProps]);

  const [emojis, setEmojis] = React.useState<Array<AnimatedEmojiProps>>([
    generateEmojiProps(),
  ]);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setEmojis(curEmojis => {
        const emojiCount = curEmojis.length;
        if (emojiCount + 1 >= NUM_EMOJIS) {
          clearInterval(timer);
        }
        return [...curEmojis, generateEmojiProps()];
      });
    }, DELAY_BETWEEN_EMOJIS);

    return () => {
      clearInterval(timer);
    };
  }, [fromY, toY, value, generateEmojiProps]);

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
  fromY: number;
  toRotate: number;
  toScale: number;
  toY: number;
  springConfig: AnimationConfig;
  onAnimationEnd?: () => unknown;
};

export function AnimatedEmoji({
  value,
  fromRotate,
  fromY,
  toRotate,
  toScale,
  toY,
  springConfig,
  onAnimationEnd,
}: AnimatedEmojiProps): JSX.Element {
  const height = EMOJI_HEIGHT * toScale;

  const { rotate, y } = useSpring({
    from: {
      rotate: fromRotate,
      y: fromY,
    },
    to: {
      rotate: toRotate,
      y: toY - height - 10,
    },
    config: springConfig,
    onRest: onAnimationEnd,
  });

  // These styles animate faster than Y.
  // Reactions toasts animate with opacity so harmonize with that.
  const { scale } = useSpring({
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
        y,
      }}
    >
      <Emojify sizeClass="medium" text={value} />
    </animated.div>
  );
}

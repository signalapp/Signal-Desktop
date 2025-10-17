// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useEffect, useRef } from 'react';
import { animated, useSpring } from '@react-spring/web';

export type StoryProgressSegmentProps = Readonly<{
  currentIndex: number;
  duration: number | null;
  index: number;
  playing: boolean;
  onFinish: () => void;
}>;

function isValidDuration(duration: number | null): boolean {
  return duration != null && Number.isFinite(duration) && duration > 0;
}

export const StoryProgressSegment = memo(function StoryProgressSegment({
  currentIndex,
  duration,
  index,
  playing,
  onFinish,
}: StoryProgressSegmentProps): JSX.Element {
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  const [progressBarStyle] = useSpring(() => {
    return {
      immediate: index !== currentIndex,
      // Pause while we are waiting for a valid duration
      pause: !playing || !isValidDuration(duration),
      from: { x: index < currentIndex ? 1 : 0 },
      to: { x: index <= currentIndex ? 1 : 0 },
      config: { duration: duration ?? Infinity },
      onRest: result => {
        if (index === currentIndex && result.finished) {
          onFinishRef.current();
        }
      },
    };
  }, [index, playing, currentIndex, duration]);

  return (
    <div
      className="StoryProgressSegment"
      aria-current={index === currentIndex ? 'step' : false}
    >
      <animated.div
        className="StoryProgressSegment__bar"
        style={{
          transform: progressBarStyle.x.to(
            value => `translateX(${value * 100 - 100}%)`
          ),
        }}
      />
    </div>
  );
});

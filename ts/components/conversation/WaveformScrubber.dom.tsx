// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useRef } from 'react';
import { useRefMerger } from '../../hooks/useRefMerger.std.js';
import type { LocalizerType } from '../../types/Util.std.js';
import { durationToPlaybackText } from '../../util/durationToPlaybackText.std.js';
import { Waveform } from './Waveform.dom.js';
import { arrow } from '../../util/keyboard.dom.js';

type Props = Readonly<{
  i18n: LocalizerType;
  peaks: ReadonlyArray<number>;
  currentTime: number;
  duration: number | undefined;
  barMinHeight: number;
  barMaxHeight: number;
  onClick: (positionAsRatio: number) => void;
  onScrub: (positionAsRatio: number) => void;
}>;

const BAR_COUNT = 47;

const REWIND_BAR_COUNT = 2;

// Increments for keyboard audio seek (in seconds)\
const SMALL_INCREMENT = 1;
const BIG_INCREMENT = 5;

export const WaveformScrubber = React.forwardRef(function WaveformScrubber(
  {
    i18n,
    peaks,
    barMinHeight,
    barMaxHeight,
    currentTime,
    duration,
    onClick,
    onScrub,
  }: Props,
  ref
): JSX.Element {
  const refMerger = useRefMerger();

  const waveformRef = useRef<HTMLDivElement | null>(null);

  // Clicking waveform moves playback head position and starts playback.
  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (!waveformRef.current) {
        return;
      }

      const boundingRect = waveformRef.current.getBoundingClientRect();
      let progress = (event.pageX - boundingRect.left) / boundingRect.width;

      if (progress <= REWIND_BAR_COUNT / BAR_COUNT) {
        progress = 0;
      }

      onClick(progress);
    },
    [waveformRef, onClick]
  );

  // Keyboard navigation for waveform. Pressing keys moves playback head
  // forward/backwards.
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!duration) {
      return;
    }

    let increment: number;

    if (event.key === 'ArrowUp' || event.key === arrow('end')) {
      increment = +SMALL_INCREMENT;
    } else if (event.key === 'ArrowDown' || event.key === arrow('start')) {
      increment = -SMALL_INCREMENT;
    } else if (event.key === 'PageUp') {
      increment = +BIG_INCREMENT;
    } else if (event.key === 'PageDown') {
      increment = -BIG_INCREMENT;
    } else {
      // We don't handle other keys
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const currentPosition = currentTime / duration;
    const positionIncrement = increment / duration;
    const newPosition = currentPosition + positionIncrement;

    onScrub(newPosition);
  };

  return (
    <div
      ref={refMerger(waveformRef, ref)}
      className="WaveformScrubber"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="slider"
      aria-label={i18n('icu:MessageAudio--slider')}
      aria-orientation="horizontal"
      aria-valuenow={currentTime}
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuetext={durationToPlaybackText(currentTime)}
    >
      <Waveform
        peaks={peaks}
        barMinHeight={barMinHeight}
        barMaxHeight={barMaxHeight}
        currentTime={currentTime}
        duration={duration}
      />
    </div>
  );
});

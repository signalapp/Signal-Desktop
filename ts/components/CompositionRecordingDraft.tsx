// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, useCallback, useRef } from 'react';
import type { ContentRect } from 'react-measure';
import Measure from 'react-measure';
import { useComputePeaks } from '../hooks/useComputePeaks';
import type { LocalizerType } from '../types/Util';
import { WaveformScrubber } from './conversation/WaveformScrubber';
import { PlaybackButton } from './PlaybackButton';
import { RecordingComposer } from './RecordingComposer';
import * as log from '../logging/log';

type Props = {
  i18n: LocalizerType;
  audioUrl: string | undefined;
  active:
    | {
        playing: boolean;
        duration: number | undefined;
        currentTime: number;
      }
    | undefined;
  onCancel: () => void;
  onSend: () => void;
  onPlay: (positionAsRatio?: number) => void;
  onPause: () => void;
  onScrub: (positionAsRatio: number) => void;
};

export function CompositionRecordingDraft({
  i18n,
  audioUrl,
  active,
  onCancel,
  onSend,
  onPlay,
  onPause,
  onScrub,
}: Props): JSX.Element {
  const [state, setState] = useState<{
    calculatingWidth: boolean;
    width: undefined | number;
  }>({ calculatingWidth: false, width: undefined });

  const timeout = useRef<undefined | NodeJS.Timeout>(undefined);

  const handleResize = useCallback(
    ({ bounds }: ContentRect) => {
      if (!bounds || bounds.width === state.width) {
        return;
      }

      if (!state.calculatingWidth) {
        setState({ ...state, calculatingWidth: true });
      }

      if (timeout.current) {
        clearTimeout(timeout.current);
      }

      const newWidth = bounds.width;

      // if mounting, set width immediately
      // otherwise debounce
      if (state.width === undefined) {
        setState({ calculatingWidth: false, width: newWidth });
      } else {
        timeout.current = setTimeout(() => {
          setState({ calculatingWidth: false, width: newWidth });
        }, 500);
      }
    },
    [state]
  );

  const handlePlaybackClick = useCallback(() => {
    if (active?.playing) {
      onPause();
    } else {
      onPlay();
    }
  }, [active, onPause, onPlay]);

  const scrubber = (
    <SizedWaveformScrubber
      i18n={i18n}
      audioUrl={audioUrl}
      activeDuration={active?.duration}
      currentTime={active?.currentTime ?? 0}
      width={state.width}
      onClick={onScrub}
      onScrub={onScrub}
    />
  );

  return (
    <RecordingComposer i18n={i18n} onCancel={onCancel} onSend={onSend}>
      <PlaybackButton
        variant="draft"
        mod={active?.playing ? 'pause' : 'play'}
        label={
          active?.playing
            ? i18n('MessageAudio--pause')
            : i18n('MessageAudio--play')
        }
        onClick={handlePlaybackClick}
      />
      <Measure bounds onResize={handleResize}>
        {({ measureRef }) => (
          <div ref={measureRef} className="CompositionRecordingDraft__sizer">
            {scrubber}
          </div>
        )}
      </Measure>
    </RecordingComposer>
  );
}

type SizedWaveformScrubberProps = {
  i18n: LocalizerType;
  audioUrl: string | undefined;
  // undefined if we don't have a size yet
  width: number | undefined;
  // defined if we are playing
  activeDuration: number | undefined;
  currentTime: number;
  onScrub: (progressAsRatio: number) => void;
  onClick: (progressAsRatio: number) => void;
};
function SizedWaveformScrubber({
  i18n,
  audioUrl,
  activeDuration,
  currentTime,
  onClick,
  onScrub,
  width,
}: SizedWaveformScrubberProps) {
  const handleCorrupted = useCallback(() => {
    log.warn('SizedWaveformScrubber: audio corrupted');
  }, []);

  const { peaks, duration } = useComputePeaks({
    audioUrl,
    activeDuration,
    onCorrupted: handleCorrupted,
    barCount: Math.floor((width ?? 800) / 4),
  });

  return (
    <WaveformScrubber
      i18n={i18n}
      peaks={peaks}
      currentTime={currentTime}
      barMinHeight={2}
      barMaxHeight={20}
      duration={duration}
      onClick={onClick}
      onScrub={onScrub}
    />
  );
}

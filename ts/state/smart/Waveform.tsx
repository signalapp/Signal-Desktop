// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { noop } from 'lodash';
import React, { memo, useEffect, useState } from 'react';
import { Waveform } from '../../components/conversation/Waveform';
import type { ComputePeaksResult } from '../../components/VoiceNotesPlaybackContext';
import { VoiceNotesPlaybackContext } from '../../components/VoiceNotesPlaybackContext';
import * as log from '../../logging/log';

const BAR_COUNT = 47;

type Props = {
  // undefined if not downloaded yet
  audioUrl: string | undefined;
  computePeaks(url: string, barCount: number): Promise<ComputePeaksResult>;
  duration: number | undefined;
  onCorrupted: () => void;
  barMinHeight: number;
  barMaxHeight: number;
  currentTime: number;
};

function SmartWaveformImpl({
  audioUrl,
  barMinHeight,
  barMaxHeight,
  currentTime,
  duration: activeDuration,
  computePeaks,
  onCorrupted,
}: Props) {
  const [hasPeaks, setHasPeaks] = useState(false);
  const [peaks, setPeaks] = useState<ReadonlyArray<number>>(
    new Array(BAR_COUNT).fill(0)
  );

  const [duration, setDuration] = useState(activeDuration ?? 1e-23);

  const isComputing = audioUrl && !hasPeaks;

  // This effect loads audio file and computes its RMS peak for displaying the
  // waveform.
  useEffect(() => {
    if (!isComputing) {
      return noop;
    }

    log.info('MessageAudio: loading audio and computing waveform');

    let canceled = false;

    void (async () => {
      try {
        const { peaks: newPeaks, duration: newDuration } = await computePeaks(
          audioUrl,
          BAR_COUNT
        );
        if (canceled) {
          return;
        }
        setPeaks(newPeaks);
        setHasPeaks(true);
        setDuration(Math.max(newDuration, 1e-23));
      } catch (err) {
        log.error(
          'MessageAudio: computePeaks error, marking as corrupted',
          err
        );

        onCorrupted();
      }
    })();

    return () => {
      canceled = true;
    };
  }, [
    audioUrl,
    computePeaks,
    setDuration,
    setPeaks,
    setHasPeaks,
    onCorrupted,
    isComputing,
  ]);

  return (
    <Waveform
      peaks={peaks}
      barMinHeight={barMinHeight}
      barMaxHeight={barMaxHeight}
      duration={duration}
      currentTime={currentTime}
    />
  );
}

export const SmartWaveform = memo(function SmartWaveform(
  props: Omit<Props, 'computePeaks'>
) {
  return (
    <VoiceNotesPlaybackContext.Consumer>
      {voiceNotesPlaybackProps => {
        return (
          voiceNotesPlaybackProps && (
            <SmartWaveformImpl
              {...props}
              computePeaks={voiceNotesPlaybackProps.computePeaks}
            />
          )
        );
      }}
    </VoiceNotesPlaybackContext.Consumer>
  );
});

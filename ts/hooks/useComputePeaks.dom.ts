// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import { useEffect, useState } from 'react';
import { computePeaks } from '../components/VoiceNotesPlaybackContext.dom.js';
import { createLogger } from '../logging/log.std.js';

const { noop } = lodash;

const log = createLogger('useComputePeaks');

type WaveformData = {
  peaks: ReadonlyArray<number>;
  duration: number;
};

export function useComputePeaks({
  audioUrl,
  activeDuration,
  barCount,
  onCorrupted,
}: {
  audioUrl: string | undefined;
  activeDuration: number | undefined;
  barCount: number;
  onCorrupted: () => void;
}): { peaks: ReadonlyArray<number>; hasPeaks: boolean; duration: number } {
  const [waveformData, setWaveformData] = useState<WaveformData | undefined>(
    undefined
  );

  // This effect loads audio file and computes its RMS peak for displaying the
  // waveform.
  useEffect(() => {
    if (!audioUrl) {
      return noop;
    }

    log.info('MessageAudio: loading audio and computing waveform');

    let canceled = false;

    void (async () => {
      try {
        const { peaks: newPeaks, duration: newDuration } = await computePeaks(
          audioUrl,
          barCount
        );
        if (canceled) {
          return;
        }
        setWaveformData({
          peaks: newPeaks,
          duration: Math.max(newDuration, 1e-23),
        });
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
  }, [audioUrl, barCount, onCorrupted]);

  return {
    duration: waveformData?.duration ?? activeDuration ?? 1e-23,
    hasPeaks: waveformData !== undefined,
    peaks: waveformData?.peaks ?? new Array(barCount).fill(0),
  };
}

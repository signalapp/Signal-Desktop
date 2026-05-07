// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import { useEffect, useState } from 'react';
import { computePeaks } from '../components/VoiceNotesPlaybackContext.dom.tsx';
import { createLogger } from '../logging/log.std.ts';
import type { PeakType } from '../types/Audio.dom.tsx';

const { noop } = lodash;

const log = createLogger('useComputePeaks');

type WaveformData = {
  peaks: ReadonlyArray<PeakType>;
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
}): { peaks: ReadonlyArray<PeakType>; hasPeaks: boolean; duration: number } {
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

  let peaks = waveformData?.peaks;
  if (peaks == null) {
    const blank = new Array<PeakType>();
    for (let i = 0; i < barCount; i += 1) {
      blank.push({ value: 0, index: i });
    }
    peaks = blank;
  }

  return {
    duration: waveformData?.duration ?? activeDuration ?? 1e-23,
    hasPeaks: waveformData !== undefined,
    peaks,
  };
}

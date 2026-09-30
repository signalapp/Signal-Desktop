// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import { useEffect, useState, useMemo } from 'react';
import { computeWaveform } from '../components/VoiceNotesPlaybackContext.dom.tsx';
import { createLogger } from '../logging/log.std.ts';
import type { PeakType } from '../types/Audio.dom.tsx';

const { noop } = lodash;

const log = createLogger('useComputePeaks');

type WaveformData = {
  waveform: ReadonlyArray<number>;
  duration: number;
};

export function useComputePeaks({
  audioUrl,
  activeDuration,
  barCount,
  onCorrupted,
  waveform,
  duration,
}: {
  audioUrl: string | undefined;
  activeDuration: number | undefined;
  barCount: number;
  onCorrupted: () => void;
  waveform: ReadonlyArray<number> | undefined;
  duration: number | undefined;
}): { peaks: ReadonlyArray<PeakType>; hasPeaks: boolean; duration: number } {
  const [waveformData, setWaveformData] = useState<WaveformData | undefined>(
    undefined
  );

  // This effect loads audio file and computes it waveform for displaying the
  // waveform.
  useEffect(() => {
    // Pre-computed waveform and duration available
    if (waveform != null && duration != null) {
      // oxlint-disable-next-line react/set-state-in-effect
      setWaveformData({
        waveform,
        duration,
      });
      return noop;
    }

    if (!audioUrl) {
      return noop;
    }

    log.info('MessageAudio: loading audio and computing waveform');

    let canceled = false;

    void (async () => {
      try {
        const { waveform: newWaveform, duration: newDuration } =
          await computeWaveform(audioUrl);
        if (canceled) {
          return;
        }
        setWaveformData({
          waveform: newWaveform,
          duration: Math.max(newDuration, 1e-23),
        });
      } catch (err) {
        log.error(
          'MessageAudio: computeWaveform error, marking as corrupted',
          err
        );

        onCorrupted();
      }
    })();

    return () => {
      canceled = true;
    };
  }, [audioUrl, onCorrupted, waveform, duration]);

  const peaks = useMemo(() => {
    if (waveformData == null) {
      const blank = new Array<PeakType>();
      for (let i = 0; i < barCount; i += 1) {
        blank.push({ value: 0, index: i });
      }
      return blank;
    }
    return waveformToPeaks(waveformData.waveform, barCount);
  }, [waveformData, barCount]);

  return {
    duration: waveformData?.duration ?? activeDuration ?? 1e-23,
    hasPeaks: waveformData !== undefined,
    peaks,
  };
}

function waveformToPeaks(
  waveform: ReadonlyArray<number>,
  barCount: number
): Array<PeakType> {
  const out = new Array<PeakType>();
  const stride = waveform.length / barCount;
  for (let i = 0; i < barCount; i += 1) {
    let mean = 0;
    let count = 0;
    for (
      let j = Math.round(i * stride);
      j < Math.min((i + 1) * stride, waveform.length);
      j += 1
    ) {
      const value = waveform[j];
      if (value == null) {
        throw new Error('OOB');
      }
      mean += value / 255;
      count += 1;
    }
    out.push({ value: mean / (count + 1e-23), index: i });
  }
  return out;
}

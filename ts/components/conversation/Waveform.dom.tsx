// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import classNames from 'classnames';
import { assertDev } from '../../util/assert.std.ts';
import type { PeakType } from '../../types/Audio.dom.tsx';

type Props = {
  peaks: ReadonlyArray<PeakType>;
  barMinHeight: number;
  barMaxHeight: number;
  currentTime: number | undefined;
  duration: number | undefined;
};

export function Waveform({
  peaks,
  barMinHeight,
  barMaxHeight,
  currentTime,
  duration,
}: Props): JSX.Element {
  const currentTimeOrZero = currentTime ?? 0;
  const peakPosition = peaks.length * (currentTimeOrZero / (duration ?? 1e-23));

  return (
    <div className={classNames(['Waveform'])}>
      {peaks.map(({ value, index }, i) => {
        assertDev(
          value >= 0 && value <= 1 && !Number.isNaN(value),
          `Peak outside of range: ${value}`
        );

        let height = Math.max(barMinHeight, barMaxHeight * value);

        const highlight = i < peakPosition;

        // Use maximum height for current audio position
        if (highlight && i + 1 >= peakPosition) {
          height = barMaxHeight;
        }

        assertDev(!Number.isNaN(height), 'Got NaN for peak height');

        return (
          <div
            className={classNames([
              'Waveform__bar',
              highlight ? 'Waveform__bar--active' : null,
            ])}
            key={index}
            style={{ height }}
          />
        );
      })}
    </div>
  );
}

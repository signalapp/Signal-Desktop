// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import classNames from 'classnames';
import React from 'react';
import { assertDev } from '../../util/assert.std.js';

type Props = {
  peaks: ReadonlyArray<number>;
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
      {peaks.map((peak, i) => {
        assertDev(
          peak >= 0 && peak <= 1 && !Number.isNaN(peak),
          `Peak outside of range: ${peak}`
        );

        let height = Math.max(barMinHeight, barMaxHeight * peak);

        const highlight = i < peakPosition;

        // Use maximum height for current audio position
        if (highlight && i + 1 >= peakPosition) {
          height = barMaxHeight;
        }

        assertDev(!Number.isNaN(height), 'Got NaN for peak height');

        const key = i;

        return (
          <div
            className={classNames([
              'Waveform__bar',
              highlight ? 'Waveform__bar--active' : null,
            ])}
            key={key}
            style={{ height }}
          />
        );
      })}
    </div>
  );
}

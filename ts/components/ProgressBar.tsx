// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

export function ProgressBar({
  fractionComplete,
  isRTL,
}: {
  fractionComplete: number;
  isRTL: boolean;
}): JSX.Element {
  return (
    <div className="ProgressBar">
      <div
        className="ProgressBar__fill"
        style={{
          transform: `translateX(${(isRTL ? -1 : 1) * (fractionComplete - 1) * 100}%)`,
        }}
      />
    </div>
  );
}

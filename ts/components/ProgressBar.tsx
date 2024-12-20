// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

export function ProgressBar({
  fractionComplete,
  isRTL,
}: {
  fractionComplete: number | null;
  isRTL: boolean;
}): JSX.Element {
  if (fractionComplete == null) {
    return (
      <div className="ProgressBar">
        <div className="ProgressBar__fill ProgressBar__fill--spinning" />
      </div>
    );
  }
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

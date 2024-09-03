// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

export function ProgressBar({
  fractionComplete,
}: {
  fractionComplete: number;
}): JSX.Element {
  return (
    <div className="ProgressBar">
      <div
        className="ProgressBar__fill"
        style={{
          marginInlineEnd: `${(1 - fractionComplete) * 100}%`,
        }}
      />
    </div>
  );
}

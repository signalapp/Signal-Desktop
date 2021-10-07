// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

export type PropsType = {
  backgroundColor: string;
  content: string;
  foregroundColor: string;
};

export function IdenticonSVG({
  backgroundColor,
  content,
  foregroundColor,
}: PropsType): JSX.Element {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <circle cx="50" cy="50" r="40" fill={backgroundColor} />
      <text
        baselineShift="-8px"
        fill={foregroundColor}
        fontFamily="sans-serif"
        fontSize="24px"
        textAnchor="middle"
        x="50"
        y="50"
      >
        {content}
      </text>
    </svg>
  );
}

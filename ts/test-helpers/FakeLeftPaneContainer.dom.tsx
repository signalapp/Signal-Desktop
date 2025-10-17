// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { WidthBreakpoint } from '../components/_util.std.js';

type PropsType = {
  children?: React.ReactNode;
  containerWidthBreakpoint: WidthBreakpoint;
};

const WIDTHS = {
  [WidthBreakpoint.Wide]: 350,
  [WidthBreakpoint.Medium]: 280,
  [WidthBreakpoint.Narrow]: 130,
};

export function FakeLeftPaneContainer({
  children,
  containerWidthBreakpoint,
}: PropsType): JSX.Element {
  return (
    <div
      className={`module-left-pane--width-${containerWidthBreakpoint}`}
      style={{ width: WIDTHS[containerWidthBreakpoint] }}
    >
      {children}
    </div>
  );
}

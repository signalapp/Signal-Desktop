// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode, JSX } from 'react';

import { WidthBreakpoint } from '../components/_util.std.ts';

type PropsType = {
  children?: ReactNode;
  containerWidthBreakpoint: WidthBreakpoint;
};

const WIDTHS = {
  [WidthBreakpoint.Wide]: 350,
  [WidthBreakpoint.Medium]: 280,
  [WidthBreakpoint.Narrow]: 130,
};

const WidthBreakpointClassNames: Record<WidthBreakpoint, string> = {
  [WidthBreakpoint.Wide]: 'module-left-pane--width-wide',
  [WidthBreakpoint.Medium]: 'module-left-pane--width-medium',
  [WidthBreakpoint.Narrow]: 'module-left-pane--width-narrow',
};

export function FakeLeftPaneContainer({
  children,
  containerWidthBreakpoint,
}: PropsType): JSX.Element {
  return (
    <div
      className={WidthBreakpointClassNames[containerWidthBreakpoint]}
      style={{ width: WIDTHS[containerWidthBreakpoint] }}
    >
      {children}
    </div>
  );
}

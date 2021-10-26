// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FunctionComponent } from 'react';
import React from 'react';
import { WidthBreakpoint } from '../../components/_util';

type PropsType = {
  containerWidthBreakpoint: WidthBreakpoint;
};

const WIDTHS = {
  [WidthBreakpoint.Wide]: 350,
  [WidthBreakpoint.Medium]: 280,
  [WidthBreakpoint.Narrow]: 130,
};

export const FakeLeftPaneContainer: FunctionComponent<PropsType> = ({
  children,
  containerWidthBreakpoint,
}) => {
  return (
    <div
      className={`module-left-pane--width-${containerWidthBreakpoint}`}
      style={{ width: WIDTHS[containerWidthBreakpoint] }}
    >
      {children}
    </div>
  );
};

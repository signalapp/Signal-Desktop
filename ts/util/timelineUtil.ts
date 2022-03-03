// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { WidthBreakpoint } from '../components/_util';

export function getWidthBreakpoint(width: number): WidthBreakpoint {
  if (width > 606) {
    return WidthBreakpoint.Wide;
  }
  if (width > 514) {
    return WidthBreakpoint.Medium;
  }
  return WidthBreakpoint.Narrow;
}

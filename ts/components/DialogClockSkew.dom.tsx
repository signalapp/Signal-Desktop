// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState, type JSX } from 'react';
import type { LocalizerType } from '../types/Util.std.ts';
import type { WidthBreakpoint } from './_util.std.ts';
import { LeftPaneDialog } from './LeftPaneDialog.dom.tsx';
import { formatTimestamp } from '../util/formatTimestamp.dom.ts';
import { SECOND } from '../util/durations/index.std.ts';

export type PropsType = {
  containerWidthBreakpoint: WidthBreakpoint;
  i18n: LocalizerType;
};

export function DialogClockSkew({
  containerWidthBreakpoint,
  i18n,
}: PropsType): JSX.Element | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 30 * SECOND);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const deviceDateTime = formatTimestamp(now, {
    dateStyle: 'medium',
    timeStyle: 'long',
  });

  return (
    <LeftPaneDialog
      containerWidthBreakpoint={containerWidthBreakpoint}
      type="error"
    >
      <div>{i18n('icu:clockSkewDetected')}</div>
      <div>{deviceDateTime}</div>
    </LeftPaneDialog>
  );
}

// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LocaleDirection } from '../../app/locale.main.js';

export type LogicalDirection = 'start' | 'end';
export type HorizontalArrowKey = 'ArrowLeft' | 'ArrowRight';

const logicalArrows: Record<
  LogicalDirection,
  Record<LocaleDirection, HorizontalArrowKey>
> = {
  start: { ltr: 'ArrowLeft', rtl: 'ArrowRight' },
  end: { ltr: 'ArrowRight', rtl: 'ArrowLeft' },
};

export function arrow(logicalDirection: LogicalDirection): HorizontalArrowKey {
  const localeDirection =
    window.SignalContext.getResolvedMessagesLocaleDirection();
  return logicalArrows[logicalDirection][localeDirection];
}

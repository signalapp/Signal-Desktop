// Copyright 2019-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { forwardRef } from 'react';

import type { LocalizerType } from '../../types/Util';

export type Props = {
  count: number;
  i18n: LocalizerType;
};

export const LastSeenIndicator = forwardRef<HTMLDivElement, Props>(
  ({ count, i18n }, ref) => {
    const message =
      count === 1
        ? i18n('unreadMessage')
        : i18n('unreadMessages', [String(count)]);

    return (
      <div className="module-last-seen-indicator" ref={ref}>
        <div className="module-last-seen-indicator__bar" />
        <div className="module-last-seen-indicator__text">{message}</div>
      </div>
    );
  }
);

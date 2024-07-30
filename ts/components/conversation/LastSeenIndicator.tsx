// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { forwardRef } from 'react';

import type { LocalizerType } from '../../types/Util';

export type Props = {
  count: number;
  i18n: LocalizerType;
};

export const LastSeenIndicator = forwardRef<HTMLDivElement, Props>(
  function LastSeenIndicatorInner({ count, i18n }, ref) {
    return (
      <div className="module-last-seen-indicator" ref={ref}>
        <div className="module-last-seen-indicator__bar" role="separator" />
        <div
          aria-level={6}
          className="module-last-seen-indicator__text"
          role="heading"
        >
          {i18n('icu:unreadMessages', { count })}
        </div>
      </div>
    );
  }
);

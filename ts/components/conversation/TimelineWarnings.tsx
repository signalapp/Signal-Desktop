// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { forwardRef } from 'react';

const CLASS_NAME = 'module-TimelineWarnings';

type PropsType = {
  children: ReactNode;
};

export const TimelineWarnings = forwardRef<HTMLDivElement, PropsType>(
  function TimelineWarningsInner({ children }, ref) {
    return (
      <div className={CLASS_NAME} ref={ref}>
        {children}
      </div>
    );
  }
);

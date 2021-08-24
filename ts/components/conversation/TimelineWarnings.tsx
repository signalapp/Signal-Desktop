// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { forwardRef, ReactNode } from 'react';

const CLASS_NAME = 'module-TimelineWarnings';

type PropsType = {
  children: ReactNode;
};

export const TimelineWarnings = forwardRef<HTMLDivElement, PropsType>(
  ({ children }, ref) => (
    <div className={CLASS_NAME} ref={ref}>
      {children}
    </div>
  )
);

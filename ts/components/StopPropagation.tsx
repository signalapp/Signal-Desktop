// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React from 'react';

// Whenever you don't want click or key events to propagate into their parent container
export const StopPropagation = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): JSX.Element => (
  // eslint-disable-next-line jsx-a11y/no-static-element-interactions
  <div
    className={className}
    onClick={ev => ev.stopPropagation()}
    onKeyDown={ev => ev.stopPropagation()}
  >
    {children}
  </div>
);

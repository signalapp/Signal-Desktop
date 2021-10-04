// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { ReactNode } from 'react';

// Whenever you don't want click events to propagate into their parent container
export const StopPropagation = ({
  children,
}: {
  children: ReactNode;
}): JSX.Element => (
  // eslint-disable-next-line max-len
  // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
  <div onClick={ev => ev.stopPropagation()}>{children}</div>
);

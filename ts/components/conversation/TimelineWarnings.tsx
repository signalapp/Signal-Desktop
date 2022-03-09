// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FunctionComponent } from 'react';
import React from 'react';

const CLASS_NAME = 'module-TimelineWarnings';

export const TimelineWarnings: FunctionComponent = ({ children }) => (
  <div className={CLASS_NAME}>{children}</div>
);

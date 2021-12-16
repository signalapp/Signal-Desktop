// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import React from 'react';

export const InstallScreenSignalLogo = (): ReactElement => (
  // Because "Signal" should be the same in every language, this is not localized.
  <div className="InstallScreenSignalLogo">Signal</div>
);

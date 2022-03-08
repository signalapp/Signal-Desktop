// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import React from 'react';
import type { AvatarSize } from './Avatar';

export const AvatarSpacer = ({
  size,
}: Readonly<{ size: AvatarSize }>): ReactElement => (
  <div style={{ minWidth: size, height: size, width: size }} />
);

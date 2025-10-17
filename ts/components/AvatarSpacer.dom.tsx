// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import React from 'react';
import type { AvatarSize } from './Avatar.dom.js';

export function AvatarSpacer({
  size,
}: Readonly<{ size: AvatarSize }>): ReactElement {
  return <div style={{ minWidth: size, height: size, width: size }} />;
}

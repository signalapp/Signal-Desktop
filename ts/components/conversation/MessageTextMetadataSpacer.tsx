// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import React from 'react';

const SPACING = 10;

export const MessageTextMetadataSpacer = ({
  metadataWidth,
}: Readonly<{ metadataWidth: number }>): ReactElement => (
  <span style={{ display: 'inline-block', width: metadataWidth + SPACING }} />
);

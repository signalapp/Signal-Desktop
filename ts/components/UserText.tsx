// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react';
import { Emojify } from './conversation/Emojify';

export function UserText({ text }: { text: string }): JSX.Element {
  return (
    <span dir="auto">
      <Emojify text={text} />
    </span>
  );
}

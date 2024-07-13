// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useMemo } from 'react';
import { Emojify } from './conversation/Emojify';
import { bidiIsolate } from '../util/unicodeBidi';

export function UserText({ text }: { text: string }): JSX.Element {
  const normalizedText = useMemo(() => {
    return bidiIsolate(text);
  }, [text]);
  return (
    <span dir="auto">
      <Emojify text={normalizedText} />
    </span>
  );
}

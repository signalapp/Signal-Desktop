// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useMemo } from 'react';
import { Emojify } from './conversation/Emojify.dom.js';
import { bidiIsolate } from '../util/unicodeBidi.std.js';

export type UserTextProps = Readonly<{
  text: string;
}>;

export function UserText(props: UserTextProps): JSX.Element {
  const normalizedText = useMemo(() => {
    return bidiIsolate(props.text);
  }, [props.text]);
  return (
    <span dir="auto">
      <Emojify text={normalizedText} />
    </span>
  );
}

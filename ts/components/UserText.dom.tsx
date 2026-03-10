// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { Emojify } from './conversation/Emojify.dom.js';
import { bidiIsolate } from '../util/unicodeBidi.std.js';

export type UserTextProps = Readonly<{
  text: string;
  fontSizeOverride?: number;
  style?: CSSProperties;
}>;

export function UserText(props: UserTextProps): React.JSX.Element {
  const normalizedText = useMemo(() => {
    return bidiIsolate(props.text);
  }, [props.text]);
  return (
    <span dir="auto">
      <Emojify
        fontSizeOverride={props.fontSizeOverride}
        style={props.style}
        text={normalizedText}
      />
    </span>
  );
}

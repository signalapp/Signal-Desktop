// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { type JSX } from 'react';
import { tw } from '../../axo/tw.dom.tsx';
import { AxoSymbol } from '../../axo/AxoSymbol.dom.tsx';

export function OfficialChatInlineBadge(): JSX.Element {
  return (
    <span
      className={tw(
        'relative z-0 inline-block rounded-full text-color-fill-primary',
        // Since the icon does not have a white checkmark built into the font, by making it a
        // background of the parent element we can ensure that the background is clipped
        // whenever the icon is (e.g. for overflow: ellipsis)
        'bg-linear-0 from-label-primary-on-color to-label-primary-on-color',
        'bg-size-[50%_50%] bg-center bg-no-repeat'
      )}
    >
      <AxoSymbol.InlineGlyph symbol="officialbadge-fill" label={null} />
    </span>
  );
}

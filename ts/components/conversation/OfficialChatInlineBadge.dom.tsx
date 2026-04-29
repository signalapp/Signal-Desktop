// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { type JSX } from 'react';
import { tw } from '../../axo/tw.dom.tsx';
import { AxoSymbol } from '../../axo/AxoSymbol.dom.tsx';

export function OfficialChatInlineBadge(): JSX.Element {
  return (
    <span
      className={tw(
        'relative z-0 text-color-fill-primary',
        // oxlint-disable-next-line better-tailwindcss/no-unknown-classes
        'before:content[""] before:absolute before:inset-s-1/6 before:top-1/6 before:bg-label-primary-on-color',
        'before:legacy-z-index-negative before:size-2/3 before:rounded-full'
      )}
    >
      <AxoSymbol.InlineGlyph symbol="officialbadge-fill" label={null} />
    </span>
  );
}

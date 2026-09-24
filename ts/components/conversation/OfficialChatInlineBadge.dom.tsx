// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { type JSX } from 'react';
import { tw } from '../../axo/tw.dom.tsx';
import { AxoSymbol } from '../../axo/AxoSymbol.dom.tsx';

export function OfficialChatInlineBadge(): JSX.Element {
  return (
    <span
      className={tw(
        'relative z-0 inline-block rounded-full text-(--axo-color-fill-accent)',
        // Since the icon does not have a white checkmark built into the font, by making it a
        // background of the parent element we can ensure that the background is clipped
        // whenever the icon is (e.g. for overflow: ellipsis)
        'bg-linear-0 from-(--axo-color-label-primary-oncolor) to-(--axo-color-label-primary-oncolor)',
        'bg-size-[50%_50%] bg-center bg-no-repeat'
      )}
    >
      <AxoSymbol.InlineGlyph symbol="seal-check-fill" label={null} />
    </span>
  );
}

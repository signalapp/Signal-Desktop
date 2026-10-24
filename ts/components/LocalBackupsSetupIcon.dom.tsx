// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { AxoSymbol } from '../axo/AxoSymbol.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';

export type LocalBackupsSetupIconProps = Readonly<{
  symbol: 'key' | 'lock';
}>;

export function LocalBackupsSetupIcon(
  props: LocalBackupsSetupIconProps
): ReactNode {
  return (
    <div
      className={tw(
        'inline-flex size-16 items-center justify-center rounded-full bg-accent-tint text-accent'
      )}
    >
      <AxoSymbol.Icon symbol={props.symbol} size={36} label={null} />
    </div>
  );
}

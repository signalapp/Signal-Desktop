// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode, JSX } from 'react';

import { AxoTooltip } from '../../axo/AxoTooltip.dom.tsx';

import type { LocalizerType } from '../../types/I18N.std.ts';

type Props = {
  i18n: LocalizerType;
  children: ReactNode;
};

function getTooltipContent(i18n: LocalizerType): string {
  return i18n('icu:Donations__OfflineTooltip');
}

export function DonationsOfflineTooltip({
  i18n,
  children,
}: Props): JSX.Element {
  return (
    <AxoTooltip.Root label={getTooltipContent(i18n)}>
      {children}
    </AxoTooltip.Root>
  );
}

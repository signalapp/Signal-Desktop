// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';

import type { LocalizerType } from '../../types/I18N.std.ts';
import { AxoTooltip } from '../../axo/AxoTooltip.dom.tsx';

type Props = {
  i18n: LocalizerType;
  children: ReactNode;
  inAnotherCall: boolean | undefined;
};

export function getTooltipContent(i18n: LocalizerType): string {
  return i18n('icu:calling__in-another-call-tooltip');
}

export function InAnotherCallTooltip({
  i18n,
  children,
  inAnotherCall,
}: Props): ReactNode {
  if (!inAnotherCall) {
    return children;
  }
  return (
    <AxoTooltip.Root label={getTooltipContent(i18n)}>
      {children}
    </AxoTooltip.Root>
  );
}

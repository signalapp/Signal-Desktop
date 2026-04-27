// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { offsetDistanceModifier } from '../../util/popperUtil.std.ts';
import { Tooltip, TooltipPlacement } from '../Tooltip.dom.tsx';

import type { LocalizerType } from '../../types/I18N.std.ts';

type Props = {
  i18n: LocalizerType;
  children: React.ReactNode;
};

function getTooltipContent(i18n: LocalizerType): string {
  return i18n('icu:Donations__OfflineTooltip');
}

export function DonationsOfflineTooltip({
  i18n,
  children,
}: Props): React.JSX.Element {
  return (
    <Tooltip
      className="InAnotherCallTooltip"
      content={getTooltipContent(i18n)}
      direction={TooltipPlacement.Top}
      popperModifiers={[offsetDistanceModifier(15)]}
    >
      {children}
    </Tooltip>
  );
}

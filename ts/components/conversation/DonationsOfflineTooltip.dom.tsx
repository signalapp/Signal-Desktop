// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { offsetDistanceModifier } from '../../util/popperUtil.std.js';
import { Tooltip, TooltipPlacement } from '../Tooltip.dom.js';

import type { LocalizerType } from '../../types/I18N.std.js';

type Props = {
  i18n: LocalizerType;
  children: React.ReactNode;
};

export function getTooltipContent(i18n: LocalizerType): string {
  return i18n('icu:Donations__OfflineTooltip');
}

export function DonationsOfflineTooltip({
  i18n,
  children,
}: Props): JSX.Element {
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

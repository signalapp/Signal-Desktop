// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { offsetDistanceModifier } from '../../util/popperUtil';
import { Tooltip, TooltipPlacement } from '../Tooltip';

import type { LocalizerType } from '../../types/I18N';

type Props = {
  i18n: LocalizerType;
  children: React.ReactNode;
};

export function getTooltipContent(i18n: LocalizerType): string {
  return i18n('icu:calling__in-another-call-tooltip');
}

export function InAnotherCallTooltip({ i18n, children }: Props): JSX.Element {
  return (
    <Tooltip
      className="InAnotherCallTooltip"
      content={getTooltipContent(i18n)}
      direction={TooltipPlacement.Top}
      popperModifiers={[offsetDistanceModifier(5)]}
    >
      {children}
    </Tooltip>
  );
}

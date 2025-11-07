// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// ORBITAL: InAnotherCallTooltip removed - stub only

import React, { type ReactNode } from 'react';
import type { LocalizerType } from '../../types/Util.std.js';

export type PropsType = {
  children: ReactNode;
  i18n: LocalizerType;
};

export function InAnotherCallTooltip({ children }: PropsType): JSX.Element {
  return <>{children}</>;
}

export function getTooltipContent(_i18n: LocalizerType): string {
  return '';
}

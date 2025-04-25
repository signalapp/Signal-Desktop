// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { type ReactNode } from 'react';
import type { Placement } from 'react-aria';
import { Tooltip } from 'react-aria-components';

export type FunTooltipProps = Readonly<{
  placement?: Placement;
  children: ReactNode;
}>;

export function FunTooltip(props: FunTooltipProps): JSX.Element {
  return (
    <Tooltip className="FunTooltip" placement={props.placement}>
      {props.children}
    </Tooltip>
  );
}

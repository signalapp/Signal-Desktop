// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import React from 'react';
import type { Placement } from 'react-aria';
import { Dialog, Popover } from 'react-aria-components';

export type FunPopoverProps = Readonly<{
  placement?: Placement;
  children: ReactNode;
}>;

export function FunPopover(props: FunPopoverProps): JSX.Element {
  return (
    <Popover className="FunPopover" placement={props.placement}>
      <Dialog className="FunPopover__Dialog">{props.children}</Dialog>
    </Popover>
  );
}

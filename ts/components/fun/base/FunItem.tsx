// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import React from 'react';

/**
 * Button
 */

export type FunItemButtonProps = Readonly<{
  'aria-label': string;
  tabIndex: number;
  onClick: (event: ReactMouseEvent) => void;
  children: ReactNode;
}>;

export function FunItemButton(props: FunItemButtonProps): JSX.Element {
  return (
    <button
      type="button"
      className="FunItem__Button"
      aria-label={props['aria-label']}
      onClick={props.onClick}
      tabIndex={props.tabIndex}
    >
      {props.children}
    </button>
  );
}

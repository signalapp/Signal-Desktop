// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import React from 'react';

export type FunPanelProps = Readonly<{
  children: ReactNode;
}>;

export function FunPanel(props: FunPanelProps): JSX.Element {
  return <div className="FunPanel">{props.children}</div>;
}

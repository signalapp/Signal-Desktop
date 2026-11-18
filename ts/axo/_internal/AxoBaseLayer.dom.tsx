// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { memo } from 'react';
import type { FC, ReactNode } from 'react';
import { AxoTheme } from '../AxoTheme.dom.tsx';

export type AxoBaseLayerProps = Readonly<{
  children: ReactNode;
}>;

/**
 * Wraps the contents of every Axo portal. Must be rendered inside the portal.
 * Inherits any `AxoTheme.Override` from the React tree.
 */
export const AxoBaseLayer: FC<AxoBaseLayerProps> = memo(props => {
  return <AxoTheme.Inherit>{props.children}</AxoTheme.Inherit>;
});

AxoBaseLayer.displayName = 'AxoBaseLayer';

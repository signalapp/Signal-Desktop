// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { memo } from 'react';
import type { FC, ReactNode } from 'react';
import { FocusScope } from '@react-aria/focus';
import { AxoTheme } from '../AxoTheme.dom.tsx';

export type AxoBaseLayerProps = Readonly<{
  children: ReactNode;
}>;

/**
 * Wraps the contents of every Axo portal. Must be rendered inside the portal.
 *
 * - Inherits any `AxoTheme.Override` from the React tree.
 * - Lets focus into the layer when it's inside a react-aria
 *   `<FocusScope contain>`, which would otherwise pull focus back out.
 */
export const AxoBaseLayer: FC<AxoBaseLayerProps> = memo(props => {
  return (
    <AxoTheme.Inherit>
      <FocusScope>{props.children}</FocusScope>
    </AxoTheme.Inherit>
  );
});

AxoBaseLayer.displayName = 'AxoBaseLayer';

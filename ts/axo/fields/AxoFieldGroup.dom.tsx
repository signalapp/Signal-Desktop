// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode, FC } from 'react';
import { memo } from 'react';
import { AxoBaseField } from './_AxoBaseField.dom.tsx';

export namespace AxoFieldGroup {
  /**
   * <AxoFieldGroup.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    /** Disables all inputs and actions within the field. */
    disabled?: boolean;
    /** Makes all inputs within the field read-only. */
    readOnly?: boolean;
    children: ReactNode;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    return (
      <AxoBaseField.Group disabled={props.disabled} readOnly={props.readOnly}>
        {props.children}
      </AxoBaseField.Group>
    );
  });

  Root.displayName = 'AxoFieldGroup.Root';

  /**
   * <AxoFieldGroup.Separator>
   * --------------------------------------------------------------------------
   */

  /**
   * A vertical divider between segments in a multi-input field.
   *
   * @example Username + discriminator
   * ```tsx
   * <AxoFieldGroup.Root>
   *   <AxoTextField.Root placeholder="Username" ... />
   *   <AxoFieldGroup.Separator />
   *   <AxoTextField.Root placeholder="00" ... />
   * </AxoFieldGroup.Root>
   * ```
   */
  export const Separator: FC = memo(() => {
    return <AxoBaseField.Separator />;
  });

  Separator.displayName = 'AxoFieldGroup.Separator';
}

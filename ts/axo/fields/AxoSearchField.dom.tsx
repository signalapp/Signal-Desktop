// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC } from 'react';
import { memo } from 'react';
import { AxoBaseField } from './_AxoBaseField.dom.tsx';
import { UnitBytes } from '@signalapp/types';

export namespace AxoSearchField {
  /**
   * <AxoSearchField.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    /** Controls the width of the entire field. Defaults to `full`. */
    width?: AxoBaseField.Width;
    /** Disables this input. */
    disabled?: boolean;
    /** Placeholder text shown when the input is empty. */
    placeholder: string;
    /** Controlled value of the input. */
    value: string;
    /** Called with the new value on every change. */
    onValueChange: (value: string) => void;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    return (
      <AxoBaseField.Container variant="search" width={props.width}>
        <AxoBaseField.Icon symbol="search" />
        <AxoBaseField.Segment
          value={props.value}
          onValueChange={props.onValueChange}
          disabled={props.disabled}
          maxBytes={UnitBytes.KILOBYTE}
          maxGraphemes={UnitBytes.KILOBYTE}
        >
          <AxoBaseField.Input type="search" placeholder={props.placeholder} />
          <AxoBaseField.Clear />
        </AxoBaseField.Segment>
      </AxoBaseField.Container>
    );
  });

  Root.displayName = 'AxoSearchField.Root';
}

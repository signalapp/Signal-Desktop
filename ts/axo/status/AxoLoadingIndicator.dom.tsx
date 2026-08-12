// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC } from 'react';
import { memo } from 'react';
import { AxoBaseSpinner } from './_AxoBaseSpinner.dom.tsx';

export namespace AxoLoadingIndicator {
  /**
   * <AxoLoadingIndicator.Root>
   * --------------------------------------------------------------------------
   */

  /**
   * Preset sizes for standalone loading indicators, the base spinner can be
   * customized to any size, but we should primarily use that internally in
   * other Axo components.
   */
  export type Size = 'sm' | 'md' | 'lg';

  /**
   * The stroke width of the spinner.
   * TODO: We might automate this based on size.
   */
  export type Weight = AxoBaseSpinner.Weight;

  export type RootProps = Readonly<{
    size: Size;
    weight?: Weight;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    return (
      <AxoBaseSpinner.Root
        size={props.size}
        weight={props.weight ?? 'regular'}
        variant="default"
        value="indeterminate"
        track={false}
      />
    );
  });

  Root.displayName = 'AxoLoadingIndicator.Root';
}

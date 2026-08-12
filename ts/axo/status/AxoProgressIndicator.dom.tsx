// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC } from 'react';
import { memo, useMemo } from 'react';
import { AxoBaseSpinner } from './_AxoBaseSpinner.dom.tsx';

export namespace AxoProgressIndicator {
  /**
   * <AxoProgressIndicator.Root>
   * --------------------------------------------------------------------------
   */

  /**
   * Preset sizes for standalone spinners, the base spinner can be customized
   * to any size, but we should primarily use that internally in Axo components.
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
    completed: number | 'indeterminate';
    total: number | 'indeterminate';
    noTrack?: boolean;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    const { completed, total } = props;

    const value = useMemo((): AxoBaseSpinner.Value => {
      if (completed === 'indeterminate' || total === 'indeterminate') {
        return 'indeterminate';
      }
      return { completed, total };
    }, [completed, total]);

    return (
      <AxoBaseSpinner.Root
        size={props.size}
        weight={props.weight ?? 'regular'}
        variant="default"
        value={value}
        track={!props.noTrack}
      />
    );
  });

  Root.displayName = 'AxoProgressIndicator.Root';
}

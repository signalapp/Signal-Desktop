// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useEffect } from 'react';
import type { FC, ReactNode } from 'react';
import { Slot } from 'radix-ui';

const Namespace = 'AxoDragRegion';

export namespace AxoDragRegion {
  /**
   * <AxoDragRegion.Root>
   * --------------------
   */

  export type RootProps = Readonly<{
    always?: boolean;
    children: ReactNode;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    return (
      <Slot.Root data-axo-drag-region={props.always ? 'always' : 'auto'}>
        {props.children}
      </Slot.Root>
    );
  });

  Root.displayName = `${Namespace}.Root`;

  /**
   * useDisableDragRegions()
   * -----------------------
   */

  const DISABLE_ATTRIBUTE = 'data-axo-drag-region-disable';

  /**
   * New elements added to the DOM may not trigger a recalculation of draggable regions,
   * which can cause pointer events on elements rendered on top of a draggable region to be
   * ignored incorrectly.
   */
  export function useDisableDragRegions(condition: boolean): void {
    useEffect(() => {
      document.body.toggleAttribute(DISABLE_ATTRIBUTE, condition);
      return () => {
        document.body.removeAttribute(DISABLE_ATTRIBUTE);
      };
    }, [condition]);
  }
}

// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { memo, useEffect } from 'react';
import type { FC, ReactNode } from 'react';
import { Slot } from 'radix-ui';

/**
 * Marks an element as a native window drag region, allowing the user to drag
 * the app window by clicking and dragging that area (Electron `-webkit-app-region: drag`).
 *
 * @example Anatomy
 * ```tsx
 * <AxoDragRegion.Root>
 *   {children}
 * </AxoDragRegion.Root>
 * ```
 */
export namespace AxoDragRegion {
  /**
   * <AxoDragRegion.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    /**
     * When `true`, the region remains draggable even while `useDisableDragRegions`
     * is active. Used in title bar which should always be draggable.
     */
    always?: boolean;
    /**
     * The element to mark as a drag region. The attribute is applied directly
     * to the child element via `Slot` — no wrapper DOM node is added.
     */
    children: ReactNode;
  }>;

  /**
   * Marks its child element as a native window drag region.
   *
   * @example Title bar (always draggable)
   * ```tsx
   * <AxoDragRegion.Root always>
   *   <div className={tw('h-8')} />
   * </AxoDragRegion.Root>
   * ```
   *
   * @example Sidebar header (draggable when no overlay is open)
   * ```tsx
   * <AxoDragRegion.Root>
   *   <header>{children}</header>
   * </AxoDragRegion.Root>
   * ```
   */
  export const Root: FC<RootProps> = memo(props => {
    return (
      <Slot.Root data-axo-drag-region={props.always ? 'always' : 'auto'}>
        {props.children}
      </Slot.Root>
    );
  });

  Root.displayName = 'AxoDragRegion.Root';

  /**
   * useDisableDragRegions()
   * --------------------------------------------------------------------------
   */

  const DISABLE_ATTRIBUTE = 'data-axo-drag-region-disable';

  /**
   * Suspends all non-`always` drag regions while `condition` is `true`.
   *
   * Call this in any overlay (menus, call bars) that renders on top of a drag
   * region. New DOM elements don't always trigger a recalculation of draggable
   * regions in Electron, which can cause pointer events on overlapping elements
   * to be silently swallowed.
   *
   * @example Disable drag regions while a menu is open
   * ```tsx
   * useDisableDragRegions(open);
   * ```
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

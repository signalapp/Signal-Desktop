// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback } from 'react';
import type { ReactNode } from 'react';
import { tw } from '../tw.dom.js';

export namespace AxoBaseDialog {
  /**
   * AxoBaseDialog: Root
   * -------------------
   */

  export type RootProps = Readonly<{
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: ReactNode;
  }>;

  /**
   * AxoBaseDialog: Trigger
   * ----------------------
   */

  export type TriggerProps = Readonly<{
    children: ReactNode;
  }>;

  /**
   * AxoBaseDialog: Overlay
   * ----------------------
   */

  export const overlayStyles = tw(
    'absolute inset-0 flex items-center-safe justify-center-safe bg-background-overlay p-4',
    // Allow the entire overlay to be scrolled in case the window is extremely small
    'overflow-auto scrollbar-width-none',
    'data-[state=closed]:animate-exit data-[state=open]:animate-enter',
    'animate-opacity-0'
  );

  /**
   * AxoBaseDialog: Content
   * ----------------------
   */

  export const contentStyles = tw(
    'relative',
    'max-h-full min-h-fit max-w-full min-w-fit',
    'rounded-3xl bg-elevated-background-primary shadow-elevation-3 select-none',
    'outline-0 outline-border-focused focused:outline-[2.5px]',
    'data-[state=closed]:animate-exit data-[state=open]:animate-enter',
    'animate-scale-98 animate-translate-y-1'
  );

  export type ContentEscape = 'cancel-is-noop' | 'cancel-is-destructive';

  export function useContentEscapeBehavior(
    escape: ContentEscape
  ): (event: Event) => void {
    return useCallback(
      event => {
        if (escape === 'cancel-is-destructive') {
          event.preventDefault();
        }
      },
      [escape]
    );
  }
}

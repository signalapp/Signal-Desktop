// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { memo, useCallback } from 'react';
import type { FC, ReactNode } from 'react';
import { tw } from '../tw.dom.tsx';

export namespace AxoBaseDialog {
  /**
   * <AxoBaseDialog.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    /** Controlled open state. Must be used with `onOpenChange`. */
    open?: boolean;
    /** Called when the open state changes. */
    onOpenChange?: (open: boolean) => void;
    children: ReactNode;
  }>;

  /**
   * <AxoBaseDialog.Trigger>
   * --------------------------------------------------------------------------
   */

  export type TriggerProps = Readonly<{
    children: ReactNode;
  }>;

  /**
   * <AxoBaseDialog.Host>
   * --------------------------------------------------------------------------
   */

  export type HostProps = Readonly<{
    children: ReactNode;
  }>;

  export const Host: FC<HostProps> = memo(props => {
    return (
      <div
        className={tw(
          'absolute inset-0',
          'legacy-z-index-modal-host',
          'flex items-center-safe justify-center-safe',
          // Allow the entire host to be scrolled in case the window is extremely small
          'scrollbar-width-none overflow-auto'
        )}
      >
        {props.children}
      </div>
    );
  });

  Host.displayName = 'AxoBaseDialog.Host';

  /**
   * <AxoBaseDialog.Overlay>
   * --------------------------------------------------------------------------
   */

  export const overlayStyles = tw(
    'absolute inset-0 bg-overlay',
    'z-0',
    'data-[state=closed]:animate-exit data-[state=open]:animate-enter',
    'animate-opacity-0',
    'forced-colors:bg-[Canvas]'
  );

  /**
   * <AxoBaseDialog.Content>
   * --------------------------------------------------------------------------
   */

  export const contentStyles = tw(
    'relative',
    'z-10',
    'max-h-full min-h-fit',
    'overflow-hidden',
    'curved-3xl bg-material-dialog text-primary shadow-elevation-3',
    'backdrop-blur-thick',
    'not-forced-colors:outline-none not-forced-colors:keyboard-mode:focus:axo-focus-ring',
    'data-[state=closed]:animate-exit data-[state=open]:animate-enter',
    'animate-opacity-0 animate-scale-98 animate-translate-y-1',
    'will-change-transform',
    'forced-colors:border forced-colors:border-[ButtonBorder] forced-colors:bg-[Canvas] forced-colors:text-[CanvasText]'
  );

  /**
   * useContentEscapeBehavior()
   * --------------------------------------------------------------------------
   */

  /**
   * How dangerous the cancel action is considered.
   * - `cancel-is-noop`: Canceling is safe — pressing Escape or clicking outside closes the dialog.
   * - `cancel-is-destructive`: Canceling would lose user state — pressing Escape or clicking outside is disabled.
   */
  export type ContentEscape = 'cancel-is-noop' | 'cancel-is-destructive';

  /**
   * Returns an escape-key handler for `onEscapeKeyDown`.
   * Prevents default when `escape` is `cancel-is-destructive`.
   */
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

// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { memo, useCallback, useMemo, useRef } from 'react';
import type {
  FC,
  FocusEvent,
  ReactNode,
  RefCallback,
  SyntheticEvent,
} from 'react';
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
    const handleScrollEvent = useCallback((event: SyntheticEvent) => {
      // Prevent these events from bubbling up and being prevented by
      // Radix UI's scroll locking.
      event.stopPropagation();
    }, []);

    return (
      <div
        className={tw(
          'absolute inset-0',
          'legacy-z-index-modal-host',
          'size-full',
          'h-screen w-screen',
          // Allow the entire host to be scrolled in case the window is extremely small
          'overflow-auto',
          // 'scrollbar-width-none',
          'pointer-events-auto',
          'overscroll-none'
        )}
        onWheel={handleScrollEvent}
        onTouchMove={handleScrollEvent}
      >
        <div
          className={tw(
            'relative',
            'flex',
            'size-[stretch]',
            'min-h-fit min-w-fit',
            'items-center-safe justify-center-safe'
          )}
        >
          {props.children}
        </div>
      </div>
    );
  });

  Host.displayName = 'AxoBaseDialog.Host';

  /**
   * <AxoBaseDialog.Overlay>
   * --------------------------------------------------------------------------
   */

  export const overlayClassName = tw(
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

  export const contentClassName = tw(
    'relative',
    'z-10',
    'm-1',
    'max-h-full min-h-fit',
    'overflow-hidden',
    'type-body-medium text-secondary',
    'curved-30 bg-material-dialog shadow-elevation-3',
    'backdrop-blur-thick',
    'focus-visible:axo-focus-ring',
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
        event.stopPropagation();
        if (escape === 'cancel-is-destructive') {
          event.preventDefault();
        }
      },
      [escape]
    );
  }

  /**
   * useTriggerPresenceRef()
   * --------------------------------------------------------------------------
   */

  /**
   * Returns a ref callback for the `Trigger` element that reports whether a
   * trigger is currently mounted.
   */
  export function useTriggerPresenceRef(
    setHasTrigger: (hasTrigger: boolean) => void
  ): RefCallback<HTMLElement> {
    return useCallback(
      node => {
        setHasTrigger(node != null);
        return () => {
          setHasTrigger(false);
        };
      },
      [setHasTrigger]
    );
  }

  /**
   * useContentRestoreFocusBehavior()
   * --------------------------------------------------------------------------
   */

  export type ContentRestoreFocusBehavior = Readonly<{
    dialogContentProps: {
      onFocusCapture: (event: FocusEvent) => void;
      onCloseAutoFocus: (event: Event) => void;
    };
  }>;

  /**
   * Returns `onFocusCapture` and `onCloseAutoFocus` handlers for the dialog
   * content.
   *
   * Radix restores focus to the `Trigger` when the dialog closes, so without
   * one focus would be lost to `document.body`. Instead, this restores focus to
   * whatever was focused before the dialog opened.
   *
   * The previously focused element is the `relatedTarget` of the first focus
   * event inside the dialog. Radix skips `onOpenAutoFocus` when an element
   * inside the dialog has `autoFocus` (which React focuses while committing),
   * but focus still moves into the dialog either way.
   */
  export function useContentRestoreFocusBehavior(
    hasTrigger: boolean
  ): ContentRestoreFocusBehavior {
    const previouslyFocusedRef = useRef<Element | null>(null);

    const onFocusCapture = useCallback((event: FocusEvent) => {
      if (previouslyFocusedRef.current == null) {
        previouslyFocusedRef.current = event.relatedTarget;
      }
    }, []);

    const onCloseAutoFocus = useCallback(
      (event: Event) => {
        const element = previouslyFocusedRef.current;
        previouslyFocusedRef.current = null;
        if (hasTrigger) {
          return;
        }
        event.preventDefault();
        if (element instanceof HTMLElement && element.isConnected) {
          element.focus();
        }
      },
      [hasTrigger]
    );

    return useMemo(() => {
      return { dialogContentProps: { onFocusCapture, onCloseAutoFocus } };
    }, [onFocusCapture, onCloseAutoFocus]);
  }
}

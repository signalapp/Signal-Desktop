// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createContext, useCallback, useContext } from 'react';
import type { ReactNode } from 'react';
import { tw } from '../tw.dom.js';
import { assert } from './assert.dom.js';

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
    'max-h-full min-h-fit max-w-full min-w-fit',
    'rounded-3xl bg-elevated-background-primary shadow-elevation-3 select-none',
    'outline-0 outline-border-focused focused:outline-[2.5px]',
    'data-[state=closed]:animate-exit data-[state=open]:animate-enter',
    'animate-scale-98 animate-translate-y-1'
  );

  export type ContentSize = 'sm' | 'md' | 'lg';

  export type ContentSizeConfig = Readonly<{
    width: number;
    minWidth: number;
    maxBodyHeight: number;
  }>;

  // TODO: These sizes are not finalized
  export const ContentSizes: Record<ContentSize, ContentSizeConfig> = {
    sm: { width: 320, minWidth: 320, maxBodyHeight: 440 },
    md: { width: 440, minWidth: 320, maxBodyHeight: 440 },
    lg: { width: 560, minWidth: 440, maxBodyHeight: 440 },
  };

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

  export type ContentProps = Readonly<{
    escape: ContentEscape;
    size: ContentSize;
    children: ReactNode;
  }>;

  const ContentSizeContext = createContext<ContentSize | null>(null);

  export const ContentSizeProvider = ContentSizeContext.Provider;

  export function useContentSize(): ContentSize {
    return assert(
      useContext(ContentSizeContext),
      'Must be wrapped with dialog <Content> component'
    );
  }
}

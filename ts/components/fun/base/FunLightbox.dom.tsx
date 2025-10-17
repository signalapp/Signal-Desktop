// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode, RefObject } from 'react';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { strictAssert } from '../../../util/assert.std.js';

/**
 * Tracks the current `data-key` that has a long-press/long-focus
 */
const FunLightboxKeyContext = createContext<string | null>(null);

export function useFunLightboxKey(): string | null {
  return useContext(FunLightboxKeyContext);
}

/**
 * Provider
 */

export type FunLightboxProviderProps = Readonly<{
  containerRef: RefObject<HTMLDivElement>;
  children: ReactNode;
}>;

export function FunLightboxProvider(
  props: FunLightboxProviderProps
): JSX.Element {
  const [lightboxKey, setLightboxKey] = useState<string | null>(null);

  useEffect(() => {
    strictAssert(props.containerRef.current, 'Missing container ref');
    const container = props.containerRef.current;

    let isLongPressed = false;
    let lastLongPress: number | null = null;
    let currentKey: string | null;
    let timer: NodeJS.Timeout | undefined;

    function lookupKey(event: Event): string | null {
      if (!(event.target instanceof HTMLElement)) {
        return null;
      }
      const closest = event.target.closest('[data-key]');
      if (!(closest instanceof HTMLElement)) {
        return null;
      }
      const { key } = closest.dataset;
      strictAssert(key, 'Must have key');
      return key;
    }

    function update() {
      if (isLongPressed && currentKey != null) {
        setLightboxKey(currentKey);
      } else {
        setLightboxKey(null);
      }
    }

    function onMouseDown(event: MouseEvent) {
      currentKey = lookupKey(event);
      timer = setTimeout(() => {
        isLongPressed = true;
        update();
      }, 500);
    }

    function onMouseUp(event: MouseEvent) {
      clearTimeout(timer);
      if (isLongPressed) {
        lastLongPress = event.timeStamp;
        isLongPressed = false;
        currentKey = null;
        update();
      }
    }

    function onMouseMove(event: MouseEvent) {
      const foundKey = lookupKey(event);
      if (foundKey != null) {
        currentKey = lookupKey(event);
        update();
      }
    }

    function onClick(event: MouseEvent) {
      if (event.timeStamp === lastLongPress) {
        event.stopImmediatePropagation();
      }
    }

    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('click', onClick, { capture: true });

    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.addEventListener('click', onClick, { capture: true });
    };
  }, [props.containerRef]);

  return (
    <FunLightboxKeyContext.Provider value={lightboxKey}>
      {props.children}
    </FunLightboxKeyContext.Provider>
  );
}

/**
 * Portal
 */

export type FunLightboxPortalProps = Readonly<{
  children: ReactNode;
}>;

export function FunLightboxPortal(props: FunLightboxPortalProps): JSX.Element {
  return createPortal(props.children, document.body);
}

/**
 * Backdrop
 */

export type FunLightboxBackdropProps = Readonly<{
  children: ReactNode;
}>;

export function FunLightboxBackdrop(
  props: FunLightboxBackdropProps
): JSX.Element {
  return <div className="FunLightbox__Backdrop">{props.children}</div>;
}

/**
 * Dialog
 */

export type FunLightboxDialogProps = Readonly<{
  'aria-label': string;
  children: ReactNode;
}>;

export function FunLightboxDialog(props: FunLightboxDialogProps): JSX.Element {
  return (
    <div
      role="dialog"
      className="FunLightbox__Dialog"
      aria-label={props['aria-label']}
    >
      {props.children}
    </div>
  );
}

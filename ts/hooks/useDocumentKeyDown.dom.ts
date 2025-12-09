// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useRef } from 'react';

type KeyDownHandler = (e: KeyboardEvent) => void;
const handlers = new Set<KeyDownHandler>();

let isListenerAttached = false;

function onKeyDown(event: KeyboardEvent) {
  for (const handler of handlers) {
    handler(event);
  }
}

function addKeyDownHandler(handler: KeyDownHandler) {
  handlers.add(handler);

  if (!isListenerAttached) {
    document.addEventListener('keydown', onKeyDown);
    isListenerAttached = true;
  }
}

function removeKeyDownCallback(handler: KeyDownHandler) {
  handlers.delete(handler);

  if (isListenerAttached && handlers.size === 0) {
    document.removeEventListener('keydown', onKeyDown);
    isListenerAttached = false;
  }
}

export function useDocumentKeyDown(
  listener: (event: KeyboardEvent) => void
): void {
  const listenerRef = useRef(listener);
  useEffect(() => {
    listenerRef.current = listener;
  }, [listener]);

  useEffect(() => {
    function handler(event: KeyboardEvent) {
      listenerRef.current(event);
    }

    addKeyDownHandler(handler);
    return () => removeKeyDownCallback(handler);
  }, []);
}

// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { useCallback, useEffect, useRef } from 'react';
import { getInteractionMode } from '../../services/InteractionMode.dom.js';

type PropsType = {
  id: string;
  conversationId: string;
  isTargeted: boolean;
  targetMessage: (messageId: string, conversationId: string) => unknown;
  children: ReactNode;
};

export function InlineNotificationWrapper({
  id,
  conversationId,
  isTargeted,
  targetMessage,
  children,
}: PropsType): JSX.Element {
  const focusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isTargeted) {
      const container = focusRef.current;
      if (container && !container.contains(document.activeElement)) {
        container.focus();
      }
    }
  }, [isTargeted]);

  const handleFocus = useCallback(() => {
    if (getInteractionMode() === 'keyboard') {
      targetMessage(id, conversationId);
    }
  }, [id, conversationId, targetMessage]);

  return (
    <div
      className="module-inline-notification-wrapper"
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      ref={focusRef}
      onFocus={handleFocus}
    >
      {children}
    </div>
  );
}

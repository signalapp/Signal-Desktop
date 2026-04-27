// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useEffect, useRef } from 'react';
import classNames from 'classnames';

import type { ReactNode } from 'react';

import { getInteractionMode } from '../../services/InteractionMode.dom.ts';

export type Props = {
  id: string;
  conversationId: string;
  isTargeted: boolean;
  isSelectMode: boolean;
  isSelected: boolean;
  targetMessage: (messageId: string, conversationId: string) => unknown;
  toggleSelectMessage: (
    conversationId: string,
    messageId: string,
    shift: boolean,
    selected: boolean
  ) => void;
  children: ReactNode;
};

export function InlineNotificationWrapper({
  id,
  conversationId,
  isTargeted,
  isSelectMode,
  isSelected,
  targetMessage,
  toggleSelectMessage,
  children,
}: Props): React.JSX.Element {
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

  if (isSelectMode) {
    return (
      <div
        className={classNames(
          'module-inline-notification-wrapper',
          isSelected ? 'module-message__wrapper--selected' : undefined
        )}
        role="checkbox"
        tabIndex={0}
        ref={focusRef}
        onFocus={handleFocus}
        onClick={(event: React.MouseEvent<HTMLSpanElement>) => {
          toggleSelectMessage(conversationId, id, event.shiftKey, !isSelected);
          event.stopPropagation();
          event.preventDefault();
        }}
        onKeyDown={(event: React.KeyboardEvent<HTMLSpanElement>) => {
          if (event.code === 'Space') {
            toggleSelectMessage(
              conversationId,
              id,
              event.shiftKey,
              !isSelected
            );
            event.stopPropagation();
            event.preventDefault();
          }
        }}
      >
        <span
          aria-label="Select"
          className="module-message__select-checkbox"
          aria-checked={isSelected}
        />
        {children}
      </div>
    );
  }

  return (
    <div
      className="module-inline-notification-wrapper"
      tabIndex={0}
      ref={focusRef}
      onFocus={handleFocus}
    >
      {children}
    </div>
  );
}

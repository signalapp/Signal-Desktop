// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useSelector } from 'react-redux';
import type { StateType } from '../../state/reducer.js';

export type ConversationNoteProps = {
  conversationId: string;
  compact?: boolean;
};

export function ConversationNote({
  conversationId,
  compact = false,
}: ConversationNoteProps): JSX.Element | null {
  const note = useSelector(
    (state: StateType) =>
      state.terminal.conversationNotes[conversationId]?.note
  );

  const terminalMode = useSelector(
    (state: StateType) => state.terminal.terminalMode
  );

  if (!note || !terminalMode) {
    return null;
  }

  return (
    <div className={`ConversationNote ${compact ? 'ConversationNote--compact' : ''}`}>
      <span className="ConversationNote__icon">📝</span>
      <span className="ConversationNote__text">{note}</span>
    </div>
  );
}

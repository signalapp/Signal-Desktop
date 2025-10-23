// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTerminalActions } from '../../state/ducks/terminal.js';
import type { StateType } from '../../state/reducer.js';

export type ConversationNoteFieldProps = {
  conversationId: string;
  isActive: boolean;
  onClose?: () => void;
};

export function ConversationNoteField({
  conversationId,
  isActive,
  onClose,
}: ConversationNoteFieldProps): JSX.Element | null {
  const { setConversationNote, clearActiveNote } = useTerminalActions();

  const note = useSelector(
    (state: StateType) =>
      state.terminal.conversationNotes[conversationId]?.note || ''
  );

  const [value, setValue] = useState(note);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update local value when note changes in state
  useEffect(() => {
    setValue(note);
  }, [note]);

  // Focus input when activated
  useEffect(() => {
    if (isActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isActive]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setValue(event.target.value);
    },
    []
  );

  const handleBlur = useCallback(() => {
    if (value !== note) {
      setConversationNote(conversationId, value);
    }
    clearActiveNote();
    onClose?.();
  }, [conversationId, value, note, setConversationNote, clearActiveNote, onClose]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        setConversationNote(conversationId, value);
        clearActiveNote();
        onClose?.();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setValue(note); // Reset to original value
        clearActiveNote();
        onClose?.();
      }
    },
    [conversationId, value, note, setConversationNote, clearActiveNote, onClose]
  );

  if (!isActive) {
    return null;
  }

  return (
    <div className="ConversationNoteField">
      <input
        ref={inputRef}
        type="text"
        className="ConversationNoteField__input"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="Add a note... (Enter to save, Esc to cancel)"
        maxLength={500}
      />
    </div>
  );
}

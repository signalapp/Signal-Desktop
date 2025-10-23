// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTerminalActions } from '../../state/ducks/terminal.js';
import type { StateType } from '../../state/reducer.js';
import type { LocalizerType } from '../../types/Util.js';

export type Command = {
  id: string;
  name: string;
  description: string;
  shortcut?: string;
  execute: () => void;
};

export type CommandPaletteProps = {
  i18n: LocalizerType;
  commands: ReadonlyArray<Command>;
};

export function CommandPalette({
  i18n,
  commands,
}: CommandPaletteProps): JSX.Element | null {
  const { toggleCommandPalette, addCommandHistory } = useTerminalActions();

  const isOpen = useSelector(
    (state: StateType) => state.terminal.commandPaletteOpen
  );

  const commandHistory = useSelector(
    (state: StateType) => state.terminal.commandHistory
  );

  const [input, setInput] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter commands based on input
  const filteredCommands = React.useMemo(() => {
    if (!input) {
      return commands;
    }

    const lowerInput = input.toLowerCase();
    return commands.filter(
      cmd =>
        cmd.name.toLowerCase().includes(lowerInput) ||
        cmd.description.toLowerCase().includes(lowerInput)
    );
  }, [commands, input]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setInput('');
      setSelectedIndex(0);
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    toggleCommandPalette();
  }, [toggleCommandPalette]);

  const handleExecute = useCallback(
    (command: Command) => {
      addCommandHistory(command.name);
      command.execute();
      handleClose();
    },
    [addCommandHistory, handleClose]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex(prev =>
          Math.min(prev + 1, filteredCommands.length - 1)
        );
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const selectedCommand = filteredCommands[selectedIndex];
        if (selectedCommand) {
          handleExecute(selectedCommand);
        }
      }
    },
    [filteredCommands, selectedIndex, handleClose, handleExecute]
  );

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setInput(event.target.value);
      setSelectedIndex(0); // Reset selection when filtering
    },
    []
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div className="CommandPalette" onClick={handleClose}>
      <div
        className="CommandPalette__modal"
        onClick={e => e.stopPropagation()}
      >
        <div className="CommandPalette__input-container">
          <input
            ref={inputRef}
            type="text"
            className="CommandPalette__input"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a command... (Esc to cancel)"
          />
        </div>

        <div className="CommandPalette__results">
          {filteredCommands.length === 0 ? (
            <div className="CommandPalette__no-results">
              No commands found
            </div>
          ) : (
            filteredCommands.map((command, index) => (
              <div
                key={command.id}
                className={`CommandPalette__item ${
                  index === selectedIndex ? 'CommandPalette__item--selected' : ''
                }`}
                onClick={() => handleExecute(command)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="CommandPalette__item-name">{command.name}</div>
                <div className="CommandPalette__item-description">
                  {command.description}
                </div>
                {command.shortcut && (
                  <div className="CommandPalette__item-shortcut">
                    {command.shortcut}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {commandHistory.length > 0 && (
          <div className="CommandPalette__history">
            <div className="CommandPalette__history-title">Recent:</div>
            <div className="CommandPalette__history-items">
              {commandHistory.slice(0, 5).map((cmd, idx) => (
                <span key={idx} className="CommandPalette__history-item">
                  {cmd}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

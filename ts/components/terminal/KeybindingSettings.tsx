// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTerminalActions } from '../../state/ducks/terminal.js';
import type { KeyBinding } from '../../state/ducks/terminal.js';
import type { StateType } from '../../state/reducer.js';
import type { LocalizerType } from '../../types/Util.js';

export type KeybindingSettingsProps = {
  i18n: LocalizerType;
};

export function KeybindingSettings({
  i18n,
}: KeybindingSettingsProps): JSX.Element {
  const {
    setKeybindingMode,
    setKeybinding,
    deleteKeybinding,
    resetKeybindings,
    toggleTerminalMode,
    setCompactView,
    setMonospaceFonts,
  } = useTerminalActions();

  const keybindings = useSelector(
    (state: StateType) => state.terminal.keybindings
  );
  const keybindingMode = useSelector(
    (state: StateType) => state.terminal.keybindingMode
  );
  const terminalMode = useSelector(
    (state: StateType) => state.terminal.terminalMode
  );
  const compactView = useSelector(
    (state: StateType) => state.terminal.compactView
  );
  const monospaceFonts = useSelector(
    (state: StateType) => state.terminal.monospaceFonts
  );

  const [editingKeybinding, setEditingKeybinding] = useState<KeyBinding | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const handleModeChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const mode = event.target.value as 'default' | 'vim' | 'custom';
      setKeybindingMode(mode);
    },
    [setKeybindingMode]
  );

  const handleTerminalModeToggle = useCallback(() => {
    toggleTerminalMode();
  }, [toggleTerminalMode]);

  const handleCompactViewToggle = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setCompactView(event.target.checked);
    },
    [setCompactView]
  );

  const handleMonospaceFontsToggle = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setMonospaceFonts(event.target.checked);
    },
    [setMonospaceFonts]
  );

  const handleEditKeybinding = useCallback((keybinding: KeyBinding) => {
    setEditingKeybinding(keybinding);
  }, []);

  const handleDeleteKeybinding = useCallback(
    (id: string) => {
      if (confirm('Are you sure you want to delete this keybinding?')) {
        deleteKeybinding(id);
      }
    },
    [deleteKeybinding]
  );

  const handleResetAll = useCallback(() => {
    if (confirm('Reset all keybindings to defaults?')) {
      resetKeybindings();
    }
  }, [resetKeybindings]);

  const handleKeyPress = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isRecording || !editingKeybinding) return;

      event.preventDefault();

      const modifiers: Array<'ctrl' | 'alt' | 'shift' | 'meta'> = [];
      if (event.ctrlKey) modifiers.push('ctrl');
      if (event.altKey) modifiers.push('alt');
      if (event.shiftKey) modifiers.push('shift');
      if (event.metaKey) modifiers.push('meta');

      const updatedKeybinding: KeyBinding = {
        ...editingKeybinding,
        key: event.key,
        modifiers,
      };

      setKeybinding(updatedKeybinding);
      setEditingKeybinding(null);
      setIsRecording(false);
    },
    [isRecording, editingKeybinding, setKeybinding]
  );

  const formatKeybinding = useCallback((binding: KeyBinding) => {
    const parts: string[] = [];
    if (binding.modifiers.includes('ctrl')) parts.push('Ctrl');
    if (binding.modifiers.includes('alt')) parts.push('Alt');
    if (binding.modifiers.includes('shift')) parts.push('Shift');
    if (binding.modifiers.includes('meta')) parts.push('Meta');
    parts.push(binding.key);
    return parts.join('+');
  }, []);

  return (
    <div className="KeybindingSettings">
      <div className="KeybindingSettings__header">
        <h2>Terminal Mode Settings</h2>
      </div>

      <div className="KeybindingSettings__section">
        <h3>Display Settings</h3>

        <div className="KeybindingSettings__option">
          <label>
            <input
              type="checkbox"
              checked={terminalMode}
              onChange={handleTerminalModeToggle}
            />
            Enable Terminal Mode
          </label>
          <p className="KeybindingSettings__description">
            Bloomberg terminal-inspired dark theme with monospace fonts
          </p>
        </div>

        <div className="KeybindingSettings__option">
          <label>
            <input
              type="checkbox"
              checked={compactView}
              onChange={handleCompactViewToggle}
              disabled={!terminalMode}
            />
            Compact View
          </label>
          <p className="KeybindingSettings__description">
            Reduce spacing for a denser conversation list
          </p>
        </div>

        <div className="KeybindingSettings__option">
          <label>
            <input
              type="checkbox"
              checked={monospaceFonts}
              onChange={handleMonospaceFontsToggle}
              disabled={!terminalMode}
            />
            Monospace Fonts
          </label>
          <p className="KeybindingSettings__description">
            Use monospace fonts throughout the interface
          </p>
        </div>
      </div>

      <div className="KeybindingSettings__section">
        <h3>Keybinding Mode</h3>

        <div className="KeybindingSettings__mode-selector">
          <select value={keybindingMode} onChange={handleModeChange}>
            <option value="default">Default</option>
            <option value="vim">Vim</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        <p className="KeybindingSettings__description">
          {keybindingMode === 'vim' &&
            'Vim-style navigation: j/k for up/down, gg/G for first/last'}
          {keybindingMode === 'default' &&
            'Standard keybindings for navigation and actions'}
          {keybindingMode === 'custom' &&
            'Customize your own keybindings below'}
        </p>
      </div>

      <div className="KeybindingSettings__section">
        <div className="KeybindingSettings__section-header">
          <h3>Keybindings</h3>
          <button
            className="KeybindingSettings__reset-button"
            onClick={handleResetAll}
          >
            Reset All
          </button>
        </div>

        <div className="KeybindingSettings__list">
          {keybindings.map(binding => (
            <div key={binding.id} className="KeybindingSettings__item">
              <div className="KeybindingSettings__item-action">
                {binding.description}
              </div>

              {editingKeybinding?.id === binding.id ? (
                <input
                  type="text"
                  className="KeybindingSettings__item-input"
                  placeholder="Press key combination..."
                  onKeyDown={handleKeyPress}
                  onFocus={() => setIsRecording(true)}
                  onBlur={() => {
                    setIsRecording(false);
                    setEditingKeybinding(null);
                  }}
                  autoFocus
                />
              ) : (
                <>
                  <div className="KeybindingSettings__item-binding">
                    {formatKeybinding(binding)}
                  </div>

                  <div className="KeybindingSettings__item-actions">
                    <button
                      className="KeybindingSettings__edit-button"
                      onClick={() => handleEditKeybinding(binding)}
                    >
                      Edit
                    </button>
                    {keybindingMode === 'custom' && (
                      <button
                        className="KeybindingSettings__delete-button"
                        onClick={() => handleDeleteKeybinding(binding.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="KeybindingSettings__section">
        <h3>Quick Reference</h3>
        <div className="KeybindingSettings__reference">
          <div className="KeybindingSettings__reference-item">
            <strong>j / k</strong> - Navigate up/down conversations
          </div>
          <div className="KeybindingSettings__reference-item">
            <strong>gg / G</strong> - Go to first/last conversation
          </div>
          <div className="KeybindingSettings__reference-item">
            <strong>u</strong> - Next unread conversation
          </div>
          <div className="KeybindingSettings__reference-item">
            <strong>n</strong> - Toggle note for selected conversation
          </div>
          <div className="KeybindingSettings__reference-item">
            <strong>Ctrl+P or :</strong> - Open command palette
          </div>
          <div className="KeybindingSettings__reference-item">
            <strong>Alt+1-9</strong> - Jump to conversation 1-9
          </div>
          <div className="KeybindingSettings__reference-item">
            <strong>/</strong> - Search conversations
          </div>
          <div className="KeybindingSettings__reference-item">
            <strong>e</strong> - Archive conversation
          </div>
          <div className="KeybindingSettings__reference-item">
            <strong>m</strong> - Mute conversation
          </div>
        </div>
      </div>
    </div>
  );
}

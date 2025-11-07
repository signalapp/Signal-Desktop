// Copyright 2025 Orbital
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useState } from 'react';
import type { LocalizerType } from '../../types/Util.std';

export type OrbitalComposerMode = 'thread' | 'reply';

export type OrbitalComposerProps = {
  mode: OrbitalComposerMode;
  replyContext?: {
    author: string;
    body: string;
  };
  onSubmit: (title: string, body: string) => void | ((body: string) => void);
  onCancel?: () => void;
  i18n: LocalizerType;
};

/**
 * OrbitalComposer - Create threads or post replies
 *
 * Modes:
 * - thread: Title + body input (for creating new threads)
 * - reply: Body input only (for replying to posts)
 *
 * Features:
 * - Retro styling with Verdana font
 * - Blue primary button (Create Thread / Send)
 * - Purple secondary button (Upload Media)
 * - 2px border for input fields (retro 2000s style)
 * - Reply context display when replying
 * - Keyboard shortcuts (Cmd/Ctrl+Enter to send)
 */
export function OrbitalComposer({
  mode,
  replyContext,
  onSubmit,
  onCancel,
  i18n,
}: OrbitalComposerProps): JSX.Element {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const handleTitleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setTitle(event.target.value);
    },
    []
  );

  const handleBodyChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setBody(event.target.value);
    },
    []
  );

  const handleSubmit = useCallback(() => {
    if (mode === 'thread') {
      // Thread mode requires title
      if (!title.trim()) {
        return;
      }
      (onSubmit as (title: string, body: string) => void)(title, body);
      setTitle('');
      setBody('');
    } else {
      // Reply mode only needs body
      if (!body.trim()) {
        return;
      }
      (onSubmit as (body: string) => void)(body);
      setBody('');
    }
  }, [mode, title, body, onSubmit]);

  const handleCancel = useCallback(() => {
    setTitle('');
    setBody('');
    onCancel?.();
  }, [onCancel]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Cmd/Ctrl+Enter to submit
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const isSubmitDisabled =
    mode === 'thread' ? !title.trim() : !body.trim();

  return (
    <div className="OrbitalComposer">
      {/* Reply Context (when replying to a message) */}
      {mode === 'reply' && replyContext && (
        <div className="OrbitalComposer__reply-context">
          <div className="OrbitalComposer__reply-context__label">
            Replying to{' '}
            <span className="OrbitalComposer__reply-context__author">
              {replyContext.author}
            </span>
          </div>
          <div className="OrbitalComposer__reply-context__preview">
            {truncateText(replyContext.body, 100)}
          </div>
        </div>
      )}

      {/* Thread Title Input (only in thread mode) */}
      {mode === 'thread' && (
        <input
          type="text"
          className="OrbitalComposer__title-input"
          placeholder="Thread title (required, max 200 characters)"
          value={title}
          onChange={handleTitleChange}
          maxLength={200}
          aria-label="Thread title"
        />
      )}

      {/* Body Textarea */}
      <textarea
        className="OrbitalComposer__body-input"
        placeholder={
          mode === 'thread'
            ? 'Share your thoughts... (markdown supported)'
            : 'Add a reply...'
        }
        value={body}
        onChange={handleBodyChange}
        onKeyDown={handleKeyDown}
        aria-label={mode === 'thread' ? 'Thread body' : 'Reply body'}
      />

      {/* Actions */}
      <div className="OrbitalComposer__actions">
        <div className="OrbitalComposer__tools">
          <button
            type="button"
            className="OrbitalComposer__icon-btn"
            aria-label="Attach file"
            title="Attach file"
          >
            📎
          </button>
          <button
            type="button"
            className="OrbitalComposer__icon-btn"
            aria-label="Record video"
            title="Record video"
          >
            🎥
          </button>
          <button
            type="button"
            className="OrbitalComposer__icon-btn"
            aria-label="Add photo"
            title="Add photo"
          >
            📷
          </button>
          <button
            type="button"
            className="OrbitalComposer__icon-btn"
            aria-label="Add emoji"
            title="Add emoji"
          >
            😊
          </button>
        </div>

        <button
          type="button"
          className="OrbitalComposer__button-primary"
          onClick={handleSubmit}
          disabled={isSubmitDisabled}
          aria-label={mode === 'thread' ? 'Create thread' : 'Send reply'}
        >
          {mode === 'thread' ? 'Create Thread >>' : 'Send >>'}
        </button>
      </div>
    </div>
  );
}

/**
 * Truncate text to specified length
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
}

/**
 * Check if running on macOS
 */
function isMac(): boolean {
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
}

// Copyright 2025 Orbital
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback } from 'react';
import classNames from 'classnames';
import type { LocalizerType } from '../../types/Util.std';
import type { OrbitalThread } from './OrbitalThreadList';

export type OrbitalThreadItemProps = {
  thread: OrbitalThread;
  isActive: boolean;
  onClick: (threadId: string) => void;
  i18n: LocalizerType;
};

/**
 * OrbitalThreadItem - Individual thread in the thread list
 *
 * Features:
 * - Blue left border when active
 * - Purple left border when has unread messages
 * - Hover effect (light blue background)
 * - Thread title, author, timestamp
 * - Reply count and media indicators
 * - Retro 2000s styling
 */
export function OrbitalThreadItem({
  thread,
  isActive,
  onClick,
  i18n,
}: OrbitalThreadItemProps): JSX.Element {
  const handleClick = useCallback(() => {
    onClick(thread.id);
  }, [onClick, thread.id]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onClick(thread.id);
      }
    },
    [onClick, thread.id]
  );

  const timeAgo = getTimeAgo(thread.timestamp, i18n);
  const lastReplyTimeAgo = thread.lastReplyTimestamp
    ? getTimeAgo(thread.lastReplyTimestamp, i18n)
    : null;

  return (
    <div
      className={classNames('OrbitalThreadItem', {
        'OrbitalThreadItem--active': isActive,
        'OrbitalThreadItem--has-new': thread.isUnread,
      })}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Thread: ${thread.title}`}
      aria-current={isActive ? 'true' : undefined}
    >
      <div className="OrbitalThreadItem__title">{thread.title}</div>

      <div className="OrbitalThreadItem__meta">
        <span className="OrbitalThreadItem__author">{thread.author}</span>
        <span className="OrbitalThreadItem__date">{timeAgo}</span>

        <div className="OrbitalThreadItem__stats">
          {thread.replyCount > 0 && (
            <span className="OrbitalThreadItem__reply-count">
              {thread.replyCount}{' '}
              {thread.replyCount === 1 ? 'reply' : 'replies'}
            </span>
          )}

          {thread.hasMedia && (
            <span className="OrbitalThreadItem__media-indicator">
              {thread.hasVideo && '🎥'}
              {thread.hasImage && '📷'}
            </span>
          )}
        </div>
      </div>

      {lastReplyTimeAgo && thread.lastReplyAuthor && (
        <div className="OrbitalThreadItem__last-reply">
          Last reply by {thread.lastReplyAuthor} · {lastReplyTimeAgo}
        </div>
      )}
    </div>
  );
}

/**
 * Format timestamp as time ago string
 */
function getTimeAgo(timestamp: number, i18n: LocalizerType): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  if (hours < 24) {
    return `${hours}h ago`;
  }
  if (days < 7) {
    return `${days}d ago`;
  }

  // For older timestamps, show date
  const date = new Date(timestamp);
  const month = date.toLocaleDateString(i18n.getLocale(), { month: 'short' });
  const day = date.getDate();
  return `${month} ${day}`;
}

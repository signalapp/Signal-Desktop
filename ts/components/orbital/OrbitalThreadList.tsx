// Copyright 2025 Orbital
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useState } from 'react';
import type { LocalizerType } from '../../types/Util.std';
import { OrbitalThreadItem } from './OrbitalThreadItem';
import { OrbitalDaySeparator } from './OrbitalDaySeparator';

export type OrbitalThread = {
  id: string;
  title: string;
  author: string;
  authorId: string;
  timestamp: number;
  replyCount: number;
  hasMedia: boolean;
  hasVideo: boolean;
  hasImage: boolean;
  isUnread: boolean;
  lastReplyTimestamp?: number;
  lastReplyAuthor?: string;
  avatarUrl?: string;
};

export type OrbitalViewMode = 'threads' | 'chats';

export type OrbitalThreadListProps = {
  threads: ReadonlyArray<OrbitalThread>;
  activeThreadId?: string;
  i18n: LocalizerType;
  onThreadClick: (threadId: string) => void;
  onCreateThread: () => void;
};

/**
 * OrbitalThreadList - Displays threaded discussions in chronological order
 *
 * Features:
 * - Retro 2000s styling with Verdana font
 * - Day separators with ASCII art
 * - Active thread highlighting (blue)
 * - Unread thread highlighting (purple)
 * - Thread metadata (author, date, reply count, media indicators)
 * - Toggle between Threads and Chats views
 * - Search functionality
 */
export function OrbitalThreadList({
  threads,
  activeThreadId,
  i18n,
  onThreadClick,
  onCreateThread,
}: OrbitalThreadListProps): JSX.Element {
  const [viewMode, setViewMode] = useState<OrbitalViewMode>('threads');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const handleThreadClick = useCallback(
    (threadId: string) => {
      onThreadClick(threadId);
    },
    [onThreadClick]
  );

  const handleCreateThread = useCallback(() => {
    onCreateThread();
  }, [onCreateThread]);

  const handleViewModeChange = useCallback((mode: OrbitalViewMode) => {
    setViewMode(mode);
    setSearchQuery(''); // Clear search when switching modes
  }, []);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  }, []);

  const handleSearchClear = useCallback(() => {
    setSearchQuery('');
  }, []);

  // Group threads by day for separators
  const threadsByDay = React.useMemo(() => {
    const groups: Array<{
      dayLabel: string;
      threads: ReadonlyArray<OrbitalThread>;
    }> = [];

    let currentDayLabel = '';
    let currentThreads: Array<OrbitalThread> = [];

    threads.forEach(thread => {
      const dayLabel = getDayLabel(thread.timestamp, i18n);

      if (dayLabel !== currentDayLabel) {
        if (currentThreads.length > 0) {
          groups.push({
            dayLabel: currentDayLabel,
            threads: currentThreads,
          });
        }
        currentDayLabel = dayLabel;
        currentThreads = [thread];
      } else {
        currentThreads.push(thread);
      }
    });

    if (currentThreads.length > 0) {
      groups.push({
        dayLabel: currentDayLabel,
        threads: currentThreads,
      });
    }

    return groups;
  }, [threads, i18n]);

  return (
    <div className="OrbitalThreadList">
      <div className="OrbitalThreadList__header">
        <h2>Your Orbit</h2>
        <button
          type="button"
          className="OrbitalComposer__button-primary"
          onClick={handleCreateThread}
        >
          Create Thread
        </button>
      </div>

      {/* Search Bar */}
      <div className="OrbitalThreadList__search">
        <input
          type="text"
          className="OrbitalThreadList__search-input"
          placeholder={
            viewMode === 'threads' ? 'Search threads...' : 'Search chats...'
          }
          value={searchQuery}
          onChange={handleSearchChange}
          aria-label={
            viewMode === 'threads' ? 'Search threads' : 'Search chats'
          }
        />
        {searchQuery && (
          <button
            type="button"
            className="OrbitalThreadList__search-clear"
            onClick={handleSearchClear}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      <div className="OrbitalThreadList__container">
        {threads.length === 0 ? (
          <OrbitalEmptyState
            message="No threads yet"
            subMessage="Create your first thread to get started! ✦"
          />
        ) : (
          threadsByDay.map(({ dayLabel, threads: dayThreads }) => (
            <React.Fragment key={dayLabel}>
              <OrbitalDaySeparator label={dayLabel} />
              {dayThreads.map(thread => (
                <OrbitalThreadItem
                  key={thread.id}
                  thread={thread}
                  isActive={thread.id === activeThreadId}
                  onClick={handleThreadClick}
                  i18n={i18n}
                />
              ))}
            </React.Fragment>
          ))
        )}
      </div>

      {/* Toggle Buttons */}
      <div className="OrbitalThreadList__toggle">
        <button
          type="button"
          className={`OrbitalThreadList__toggle-button ${
            viewMode === 'threads'
              ? 'OrbitalThreadList__toggle-button--active'
              : ''
          }`}
          onClick={() => handleViewModeChange('threads')}
          aria-label="View threads"
          aria-pressed={viewMode === 'threads'}
        >
          Threads
        </button>
        <button
          type="button"
          className={`OrbitalThreadList__toggle-button ${
            viewMode === 'chats'
              ? 'OrbitalThreadList__toggle-button--active'
              : ''
          }`}
          onClick={() => handleViewModeChange('chats')}
          aria-label="View chats"
          aria-pressed={viewMode === 'chats'}
        >
          Chats
        </button>
      </div>
    </div>
  );
}

/**
 * Get day label for thread timestamp
 */
function getDayLabel(timestamp: number, i18n: LocalizerType): string {
  const now = Date.now();
  const threadDate = new Date(timestamp);
  const today = new Date(now);
  const yesterday = new Date(now - 24 * 60 * 60 * 1000);

  // Reset time to midnight for comparison
  today.setHours(0, 0, 0, 0);
  yesterday.setHours(0, 0, 0, 0);
  threadDate.setHours(0, 0, 0, 0);

  if (threadDate.getTime() === today.getTime()) {
    return 'Today';
  }
  if (threadDate.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  }

  // Format as "Mon DD"
  const month = threadDate.toLocaleDateString(i18n.getLocale(), {
    month: 'short',
  });
  const day = threadDate.getDate();
  return `${month} ${day}`;
}

/**
 * Empty state component with ASCII art
 */
function OrbitalEmptyState({
  message,
  subMessage,
}: {
  message: string;
  subMessage?: string;
}): JSX.Element {
  return (
    <div className="OrbitalEmptyState">
      <div className="OrbitalEmptyState__ascii" aria-hidden="true">
        {`╭───────────────────────╮
│   ${message.padEnd(19)}│
${subMessage ? `│   ${subMessage.padEnd(19)}│` : ''}
╰───────────────────────╯`}
      </div>
      {!subMessage && (
        <div className="OrbitalEmptyState__message">{message}</div>
      )}
    </div>
  );
}

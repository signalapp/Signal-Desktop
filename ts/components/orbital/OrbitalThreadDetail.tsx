// Copyright 2025 Orbital
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback } from 'react';
import type { LocalizerType } from '../../types/Util.std';
import { OrbitalMessage } from './OrbitalMessage';
import { OrbitalComposer } from './OrbitalComposer';

export type OrbitalMessageType = {
  id: string;
  author: string;
  authorId: string;
  timestamp: number;
  body: string;
  level: number; // Reply depth level (0 = top-level, 1-4+ = nested)
  parentId?: string; // ID of the message this is replying to
  hasMedia: boolean;
  mediaType?: 'image' | 'video';
  mediaUrl?: string;
  avatarUrl?: string; // Optional avatar URL (48x48 pixel art)
};

export type OrbitalThreadDetailProps = {
  threadId: string;
  threadTitle: string;
  threadAuthor: string;
  threadTimestamp: number;
  messages: ReadonlyArray<OrbitalMessageType>;
  currentUserId: string;
  i18n: LocalizerType;
  onReply: (parentId: string, body: string) => void;
  onSendMessage: (body: string) => void;
};

/**
 * OrbitalThreadDetail - Displays a thread with all its replies
 *
 * Features:
 * - Thread title prominently displayed
 * - Color-coded reply depth (Blue → Purple → Blue → Purple...)
 * - Indented replies (24px per level, max 96px)
 * - Original post (level 0) with white background
 * - Nested replies with increasing color saturation
 * - Reply composer at bottom
 */
export function OrbitalThreadDetail({
  threadId,
  threadTitle,
  threadAuthor,
  threadTimestamp,
  messages,
  currentUserId,
  i18n,
  onReply,
  onSendMessage,
}: OrbitalThreadDetailProps): JSX.Element {
  const handleSubmitReply = useCallback(
    (body: string) => {
      onSendMessage(body);
    },
    [onSendMessage]
  );

  return (
    <div className="OrbitalThreadDetail">
      {/* Thread Header */}
      <div className="OrbitalThreadDetail__header">
        <h1>{threadTitle}</h1>
        <div className="OrbitalMessage__meta">
          <span className="OrbitalMessage__author">{threadAuthor}</span>
          <span className="OrbitalMessage__timestamp">
            {formatTimestamp(threadTimestamp, i18n)}
          </span>
        </div>
      </div>

      {/* Thread Timeline - Messages with color-coded depth */}
      <div className="OrbitalThreadDetail__timeline">
        {messages.map(message => (
          <OrbitalMessage
            key={message.id}
            message={message}
            isOwnMessage={message.authorId === currentUserId}
            onReply={() => {}} // Reply button click handler (not used when always showing composer)
            i18n={i18n}
          />
        ))}

        {messages.length === 0 && (
          <div className="OrbitalEmptyState">
            <div className="OrbitalEmptyState__message">
              No messages yet. Be the first to reply!
            </div>
          </div>
        )}
      </div>

      {/* ASCII Separator before composer */}
      <div className="OrbitalASCII OrbitalASCII--separator" aria-hidden="true">
        ·  ·  ·  ✦  ·  ·  ·
      </div>

      {/* Reply Composer - Always visible */}
      <div className="OrbitalThreadDetail__composer-area">
        <OrbitalComposer
          mode="reply"
          onSubmit={handleSubmitReply}
          i18n={i18n}
        />
      </div>
    </div>
  );
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: number, i18n: LocalizerType): string {
  const date = new Date(timestamp);
  const now = new Date();

  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString(i18n.getLocale(), {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  if (isToday) {
    return `Today at ${time}`;
  }
  if (isYesterday) {
    return `Yesterday at ${time}`;
  }

  const month = date.toLocaleDateString(i18n.getLocale(), { month: 'short' });
  const day = date.getDate();
  const year =
    date.getFullYear() !== now.getFullYear() ? ` ${date.getFullYear()}` : '';

  return `${month} ${day}${year} at ${time}`;
}

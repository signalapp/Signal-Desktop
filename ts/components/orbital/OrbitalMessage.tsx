// Copyright 2025 Orbital
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback } from 'react';
import classNames from 'classnames';
import type { LocalizerType } from '../../types/Util.std';
import type { OrbitalMessageType } from './OrbitalThreadDetail';

export type OrbitalMessageProps = {
  message: OrbitalMessageType;
  isOwnMessage: boolean;
  onReply: (messageId: string) => void;
  onQuote?: (messageId: string) => void;
  i18n: LocalizerType;
};

/**
 * OrbitalMessage - Individual message with color-coded reply depth
 *
 * REDDIT-STYLE THREADING MODEL:
 * - Original Post: Level 0 (white background, no indent)
 * - Top-level contributions (replying to thread, not specific comments): Level 0 (white, no indent)
 * - Reply to a specific comment: Level 1+ (indented, color-coded)
 *
 * Reply Depth Color System (Signature Orbital Feature):
 * - Level 0: White background, gray border (original post AND top-level contributions)
 * - Level 1: Light blue (8% opacity), blue border (replying to a comment)
 * - Level 2: Light purple (8% opacity), purple border (nested reply)
 * - Level 3: Stronger blue (12% opacity), blue border (deeper nesting)
 * - Level 4+: Stronger purple (12% opacity), purple border (max indent)
 *
 * Pattern: Blue → Purple → Blue → Purple, with increasing opacity
 *
 * Features:
 * - Left margin indentation (24px per level, max 96px at level 4+)
 * - 3px left border matching background tint color
 * - Author name and timestamp
 * - Message body with markdown support
 * - Reply button
 * - Media display (images, videos)
 * - Retro 2000s styling (Verdana 13px)
 */
export function OrbitalMessage({
  message,
  isOwnMessage,
  onReply,
  onQuote,
  i18n,
}: OrbitalMessageProps): JSX.Element {
  const handleReply = useCallback(() => {
    onReply(message.id);
  }, [onReply, message.id]);

  const handleQuote = useCallback(() => {
    if (onQuote) {
      onQuote(message.id);
    }
  }, [onQuote, message.id]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onReply(message.id);
      }
    },
    [onReply, message.id]
  );

  // Determine CSS class based on reply depth
  const levelClass = getLevelClass(message.level);

  return (
    <div
      className={classNames('OrbitalMessage', levelClass)}
      role="article"
      aria-label={`Message from ${message.author}`}
      data-message-id={message.id}
      data-level={message.level}
    >
      {/* Message Header */}
      <div className="OrbitalMessage__header">
        <span className="OrbitalMessage__author">{message.author}</span>
        {/* Show "replied" badge for top-level contributions (level 0 but has parentId) */}
        {message.parentId && message.level === 0 && (
          <span className="OrbitalMessage__contribution-badge" title="Top-level contribution to thread">
            replied
          </span>
        )}
        <span className="OrbitalMessage__timestamp">
          {formatTimestamp(message.timestamp, i18n)}
        </span>
      </div>

      {/* Optional "Replying to" indicator (only for nested replies, not top-level contributions) */}
      {message.parentId && message.level > 0 && (
        <div className="OrbitalMessage__reply-to">
          <span className="OrbitalMessage__reply-to__arrow">↳</span>
          Replying to{' '}
          <span className="OrbitalMessage__reply-to__author">
            {/* TODO: Lookup parent author name */}
            Previous message
          </span>
        </div>
      )}

      {/* Message Body */}
      <div className="OrbitalMessage__body">
        {/* TODO: Add markdown rendering */}
        <p>{message.body}</p>

        {/* Media */}
        {message.hasMedia && message.mediaUrl && (
          <div className="OrbitalMessage__media">
            {message.mediaType === 'image' && (
              <img
                src={message.mediaUrl}
                alt="Attached image"
                style={{ maxWidth: '100%', borderRadius: '3px' }}
              />
            )}
            {message.mediaType === 'video' && (
              <video
                src={message.mediaUrl}
                controls
                style={{ maxWidth: '100%', borderRadius: '3px' }}
              >
                <track kind="captions" />
              </video>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="OrbitalMessage__actions">
        <button
          type="button"
          className="OrbitalMessage__reply-button"
          onClick={handleReply}
          onKeyDown={handleKeyDown}
          aria-label="Reply to this message"
        >
          Reply
        </button>
        {onQuote && (
          <button
            type="button"
            className="OrbitalMessage__quote-button"
            onClick={handleQuote}
            aria-label="Quote this message"
          >
            Quote
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Get CSS class for message level (reply depth)
 *
 * Pattern:
 * - Level 0: level-0 (white/gray)
 * - Level 1: level-1 (light blue)
 * - Level 2: level-2 (light purple)
 * - Level 3: level-3 (stronger blue)
 * - Level 4+: level-4-plus (stronger purple, max indent)
 */
function getLevelClass(level: number): string {
  if (level === 0) return 'OrbitalMessage--level-0';
  if (level === 1) return 'OrbitalMessage--level-1';
  if (level === 2) return 'OrbitalMessage--level-2';
  if (level === 3) return 'OrbitalMessage--level-3';
  return 'OrbitalMessage--level-4-plus'; // 4 and beyond
}

/**
 * Format timestamp (compact format for messages)
 */
function formatTimestamp(timestamp: number, i18n: LocalizerType): string {
  const date = new Date(timestamp);
  const now = new Date();

  const isToday = date.toDateString() === now.toDateString();

  const time = date.toLocaleTimeString(i18n.getLocale(), {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  if (isToday) {
    return time;
  }

  const month = date.toLocaleDateString(i18n.getLocale(), { month: 'short' });
  const day = date.getDate();

  return `${month} ${day}, ${time}`;
}

/**
 * Helper to calculate visual reply depth from message level
 *
 * This is used to determine the correct color and indentation.
 * The pattern repeats: Blue (1) → Purple (2) → Blue (3) → Purple (4+)
 */
export function getReplyDepthColor(level: number): 'blue' | 'purple' | 'neutral' {
  if (level === 0) return 'neutral';
  if (level === 1 || level === 3) return 'blue';
  return 'purple'; // level 2, 4+
}

/**
 * Get indentation in pixels for a given level
 */
export function getReplyIndentation(level: number): number {
  const INDENT_UNIT = 24; // 24px per level
  const MAX_INDENT = 96; // Maximum 96px (level 4+)

  const indent = level * INDENT_UNIT;
  return Math.min(indent, MAX_INDENT);
}

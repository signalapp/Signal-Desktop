// Copyright 2025 Orbital
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, useCallback } from 'react';
import type { LocalizerType } from '../../types/Util.std';
import { OrbitalThreadList, type OrbitalThread } from './OrbitalThreadList';
import { OrbitalThreadDetail, type OrbitalMessageType } from './OrbitalThreadDetail';

/**
 * OrbitalThreadingDemo - Demo page showcasing the threaded UI
 *
 * This demo illustrates:
 * - Thread list with day separators
 * - Reddit-style threading model (top-level contributions stay flat)
 * - Color-coded reply depth system (Blue → Purple → Blue → Purple)
 * - Retro 2000s styling
 * - Thread composer
 * - Message threading with up to level 4+ nesting
 */
export function OrbitalThreadingDemo({ i18n }: { i18n: LocalizerType }): JSX.Element {
  const [activeThreadId, setActiveThreadId] = useState<string>('thread-1');

  const handleThreadClick = useCallback((threadId: string) => {
    setActiveThreadId(threadId);
  }, []);

  const handleCreateThread = useCallback(() => {
    alert('Create thread clicked! (Not yet implemented in demo)');
  }, []);

  const handleReply = useCallback((parentId: string, body: string) => {
    alert(`Reply to ${parentId}: ${body}`);
  }, []);

  const handleSendMessage = useCallback((body: string) => {
    alert(`New message in thread: ${body}`);
  }, []);

  // Active thread data
  const activeThread = MOCK_THREADS.find(t => t.id === activeThreadId);
  const activeMessages = MOCK_MESSAGES[activeThreadId] || [];

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#FAF9F7' }}>
      {/* Left Sidebar - Thread List */}
      <div style={{ width: '320px', borderRight: '2px solid #D1D5DB' }}>
        <OrbitalThreadList
          threads={MOCK_THREADS}
          activeThreadId={activeThreadId}
          i18n={i18n}
          onThreadClick={handleThreadClick}
          onCreateThread={handleCreateThread}
        />
      </div>

      {/* Main Content - Thread Detail */}
      <div style={{ flex: 1 }}>
        {activeThread ? (
          <OrbitalThreadDetail
            threadId={activeThread.id}
            threadTitle={activeThread.title}
            threadAuthor={activeThread.author}
            threadTimestamp={activeThread.timestamp}
            messages={activeMessages}
            currentUserId="user-current"
            i18n={i18n}
            onReply={handleReply}
            onSendMessage={handleSendMessage}
          />
        ) : (
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'Verdana', fontSize: '14px', color: '#6B7280' }}>
              Select a thread to view
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// MOCK DATA
// =============================================================================

const MOCK_THREADS: ReadonlyArray<OrbitalThread> = [
  {
    id: 'thread-1',
    title: "Emma's First Steps!",
    author: 'Mom',
    authorId: 'user-mom',
    timestamp: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
    replyCount: 8,
    hasMedia: true,
    hasVideo: true,
    hasImage: false,
    isUnread: false,
    lastReplyTimestamp: Date.now() - 30 * 60 * 1000, // 30 min ago
    lastReplyAuthor: 'Grandma',
  },
  {
    id: 'thread-2',
    title: 'Family Dinner This Weekend?',
    author: 'Dad',
    authorId: 'user-dad',
    timestamp: Date.now() - 5 * 60 * 60 * 1000, // 5 hours ago
    replyCount: 4,
    hasMedia: false,
    hasVideo: false,
    hasImage: false,
    isUnread: true,
    lastReplyTimestamp: Date.now() - 1 * 60 * 60 * 1000, // 1 hour ago
    lastReplyAuthor: 'Uncle',
  },
  {
    id: 'thread-3',
    title: 'Check out these vacation photos',
    author: 'Aunt Sarah',
    authorId: 'user-aunt',
    timestamp: Date.now() - 24 * 60 * 60 * 1000, // Yesterday
    replyCount: 12,
    hasMedia: true,
    hasVideo: false,
    hasImage: true,
    isUnread: false,
  },
  {
    id: 'thread-4',
    title: 'Recipe for Grandmas cookies?',
    author: 'Cousin',
    authorId: 'user-cousin',
    timestamp: Date.now() - 48 * 60 * 60 * 1000, // 2 days ago
    replyCount: 6,
    hasMedia: false,
    hasVideo: false,
    hasImage: false,
    isUnread: false,
  },
];

/**
 * Mock messages demonstrating the Reddit-style threading model
 *
 * REDDIT-STYLE THREADING:
 * - Original Post: Level 0 (white background, no indent)
 * - Top-level contributions (replying to thread, not to comments): Level 0 (white background, no indent)
 * - Reply to a specific comment: Level 1+ (indented, color-coded)
 *
 * COLOR SYSTEM:
 * Level 0: White background, gray border (original post AND top-level contributions)
 * Level 1: Light blue (8%), blue border (replying to a comment)
 * Level 2: Light purple (8%), purple border (nested reply)
 * Level 3: Stronger blue (12%), blue border (deeper nesting)
 * Level 4+: Stronger purple (12%), purple border (max indent 96px)
 */
const MOCK_MESSAGES: Record<string, ReadonlyArray<OrbitalMessageType>> = {
  'thread-1': [
    // Top-level post (Level 0 - White/Gray)
    {
      id: 'msg-1',
      author: 'Mom',
      authorId: 'user-mom',
      timestamp: Date.now() - 2 * 60 * 60 * 1000,
      body: "Emma took her first steps today! I can't believe how fast she's growing. I recorded the whole thing!",
      level: 0,
      hasMedia: true,
      mediaType: 'video',
      mediaUrl: 'https://via.placeholder.com/400x300/5B9FED/FFFFFF?text=Video',
    },
    // First-level reply (Level 1 - Light Blue)
    {
      id: 'msg-2',
      author: 'Dad',
      authorId: 'user-dad',
      timestamp: Date.now() - 2 * 60 * 60 * 1000 + 5 * 60 * 1000,
      body: 'NO WAY!!! I missed it?! This is amazing!!',
      level: 1,
      parentId: 'msg-1',
      hasMedia: false,
    },
    // Second-level reply (Level 2 - Light Purple)
    {
      id: 'msg-3',
      author: 'Mom',
      authorId: 'user-mom',
      timestamp: Date.now() - 2 * 60 * 60 * 1000 + 10 * 60 * 1000,
      body: "Don't worry, I got it all on video! You can watch it when you get home!",
      level: 2,
      parentId: 'msg-2',
      hasMedia: false,
    },
    // Third-level reply (Level 3 - Stronger Blue)
    {
      id: 'msg-4',
      author: 'Grandma',
      authorId: 'user-grandma',
      timestamp: Date.now() - 2 * 60 * 60 * 1000 + 15 * 60 * 1000,
      body: "That's wonderful! She's growing up so fast. Can't wait to see the video!",
      level: 3,
      parentId: 'msg-3',
      hasMedia: false,
    },
    // Fourth-level reply (Level 4+ - Stronger Purple, max indent)
    {
      id: 'msg-5',
      author: 'Mom',
      authorId: 'user-mom',
      timestamp: Date.now() - 2 * 60 * 60 * 1000 + 20 * 60 * 1000,
      body: "I'll share it in the family album too!",
      level: 4,
      parentId: 'msg-4',
      hasMedia: false,
    },
    // Another first-level reply (Level 1 - Light Blue)
    {
      id: 'msg-6',
      author: 'Uncle',
      authorId: 'user-uncle',
      timestamp: Date.now() - 1 * 60 * 60 * 1000,
      body: "Time to baby-proof the house! She'll be running around before you know it!",
      level: 1,
      parentId: 'msg-1',
      hasMedia: false,
    },
    // Second-level reply to Uncle (Level 2 - Light Purple)
    {
      id: 'msg-7',
      author: 'Dad',
      authorId: 'user-dad',
      timestamp: Date.now() - 45 * 60 * 1000,
      body: 'Already on it! Putting up baby gates this weekend.',
      level: 2,
      parentId: 'msg-6',
      hasMedia: false,
    },
    // Latest reply (Level 3 - Stronger Blue)
    {
      id: 'msg-8',
      author: 'Grandma',
      authorId: 'user-grandma',
      timestamp: Date.now() - 30 * 60 * 1000,
      body: "I can bring over some extra gates if you need them! I still have them from when you were little!",
      level: 3,
      parentId: 'msg-7',
      hasMedia: false,
    },
  ],
  'thread-2': [
    // Original post (Level 0)
    {
      id: 'msg-2-1',
      author: 'Dad',
      authorId: 'user-dad',
      timestamp: Date.now() - 5 * 60 * 60 * 1000,
      body: "How about we all get together for dinner this weekend? It's been too long!",
      level: 0,
      hasMedia: false,
    },
    // REDDIT-STYLE: Multiple people contributing to thread (all Level 0 - no nesting!)
    // These are NOT replies to each other, they're independent contributions to the thread
    {
      id: 'msg-2-2',
      author: 'Mom',
      authorId: 'user-mom',
      timestamp: Date.now() - 4 * 60 * 60 * 1000,
      body: "I'm in! Saturday or Sunday?",
      level: 0, // CHANGED: Top-level contribution, not a nested reply
      parentId: 'msg-2-1',
      hasMedia: false,
    },
    {
      id: 'msg-2-3',
      author: 'Grandma',
      authorId: 'user-grandma',
      timestamp: Date.now() - 3 * 60 * 60 * 1000 + 30 * 60 * 1000,
      body: 'Saturday works better for me!',
      level: 0, // CHANGED: Another top-level contribution
      parentId: 'msg-2-1',
      hasMedia: false,
    },
    {
      id: 'msg-2-4',
      author: 'Uncle',
      authorId: 'user-uncle',
      timestamp: Date.now() - 3 * 60 * 60 * 1000,
      body: "Count me in! I'll bring dessert!",
      level: 0, // CHANGED: Top-level contribution
      parentId: 'msg-2-1',
      hasMedia: false,
    },
    {
      id: 'msg-2-5',
      author: 'Aunt Sarah',
      authorId: 'user-aunt',
      timestamp: Date.now() - 2 * 60 * 60 * 1000,
      body: 'We can host at our place if you want! We have plenty of space.',
      level: 0, // CHANGED: Top-level contribution
      parentId: 'msg-2-1',
      hasMedia: false,
    },
    {
      id: 'msg-2-6',
      author: 'Cousin',
      authorId: 'user-cousin',
      timestamp: Date.now() - 1 * 60 * 60 * 1000 + 30 * 60 * 1000,
      body: 'Can I bring my famous mac and cheese?',
      level: 0, // CHANGED: Top-level contribution
      parentId: 'msg-2-1',
      hasMedia: false,
    },
    {
      id: 'msg-2-7',
      author: 'Dad',
      authorId: 'user-dad',
      timestamp: Date.now() - 1 * 60 * 60 * 1000,
      body: 'Sounds like a plan! Saturday at Sarah and John\'s place. See you all at 6pm!',
      level: 0, // CHANGED: Top-level contribution (Dad wrapping up)
      parentId: 'msg-2-1',
      hasMedia: false,
    },
  ],
  'thread-3': [
    // Original post
    {
      id: 'msg-3-1',
      author: 'Aunt Sarah',
      authorId: 'user-aunt',
      timestamp: Date.now() - 24 * 60 * 60 * 1000,
      body: 'Just got back from our vacation! Here are some photos from the beach.',
      level: 0,
      hasMedia: true,
      mediaType: 'image',
      mediaUrl: 'https://via.placeholder.com/400x300/9B87F5/FFFFFF?text=Beach+Photo',
    },
    // REDDIT-STYLE: First wave of reactions (all level 0 - top-level contributions)
    {
      id: 'msg-3-2',
      author: 'Mom',
      authorId: 'user-mom',
      timestamp: Date.now() - 23 * 60 * 60 * 1000,
      body: 'Gorgeous! The water looks so clear!',
      level: 0, // CHANGED: Top-level contribution
      parentId: 'msg-3-1',
      hasMedia: false,
    },
    {
      id: 'msg-3-3',
      author: 'Grandma',
      authorId: 'user-grandma',
      timestamp: Date.now() - 23 * 60 * 60 * 1000 + 15 * 60 * 1000,
      body: 'What a beautiful sunset! Where was this taken?',
      level: 0, // CHANGED: Top-level contribution
      parentId: 'msg-3-1',
      hasMedia: false,
    },
    {
      id: 'msg-3-4',
      author: 'Uncle',
      authorId: 'user-uncle',
      timestamp: Date.now() - 23 * 60 * 60 * 1000 + 20 * 60 * 1000,
      body: 'The kids look like they had a blast!',
      level: 0, // CHANGED: Top-level contribution
      parentId: 'msg-3-1',
      hasMedia: false,
    },
    // Now Mom's comment gets a NESTED reply (level 1+)
    {
      id: 'msg-3-5',
      author: 'Aunt Sarah',
      authorId: 'user-aunt',
      timestamp: Date.now() - 22 * 60 * 60 * 1000,
      body: 'It was crystal clear! Best snorkeling ever.',
      level: 1, // CHANGED from 2 to 1: First nesting level (replying to Mom's comment)
      parentId: 'msg-3-2',
      hasMedia: false,
    },
    // Mom and Dad have a side conversation (nested deeper)
    {
      id: 'msg-3-6',
      author: 'Mom',
      authorId: 'user-mom',
      timestamp: Date.now() - 21 * 60 * 60 * 1000,
      body: 'We should plan a beach trip too! Emma would love it.',
      level: 2, // CHANGED from 3 to 2: Replying to Aunt's comment
      parentId: 'msg-3-5',
      hasMedia: false,
    },
    {
      id: 'msg-3-7',
      author: 'Dad',
      authorId: 'user-dad',
      timestamp: Date.now() - 20 * 60 * 60 * 1000,
      body: 'I was thinking the same thing! Maybe next summer?',
      level: 3, // CHANGED from 4 to 3: Replying to Mom's nested comment
      parentId: 'msg-3-6',
      hasMedia: false,
    },
    // Meanwhile, Grandma's question gets answered (another branch)
    {
      id: 'msg-3-8',
      author: 'Aunt Sarah',
      authorId: 'user-aunt',
      timestamp: Date.now() - 20 * 60 * 60 * 1000,
      body: 'This was at Maui! Stayed there for a week.',
      level: 1, // CHANGED from 2 to 1: Replying to Grandma's comment
      parentId: 'msg-3-3',
      hasMedia: false,
    },
    {
      id: 'msg-3-9',
      author: 'Grandma',
      authorId: 'user-grandma',
      timestamp: Date.now() - 19 * 60 * 60 * 1000,
      body: 'Oh how wonderful! I went there in the 80s. Still beautiful!',
      level: 2, // CHANGED from 3 to 2: Replying to Aunt's nested answer
      parentId: 'msg-3-8',
      hasMedia: false,
    },
    // More top-level contributions
    {
      id: 'msg-3-10',
      author: 'Cousin',
      authorId: 'user-cousin',
      timestamp: Date.now() - 18 * 60 * 60 * 1000,
      body: 'Love the sandcastle pic! Did the kids build that?',
      level: 0, // CHANGED: Top-level contribution
      parentId: 'msg-3-1',
      hasMedia: false,
    },
    // Cousin's question gets a nested answer
    {
      id: 'msg-3-11',
      author: 'Aunt Sarah',
      authorId: 'user-aunt',
      timestamp: Date.now() - 17 * 60 * 60 * 1000,
      body: 'Yes! Took them 2 hours but they were so proud!',
      level: 1, // CHANGED from 2 to 1: Replying to Cousin's comment
      parentId: 'msg-3-10',
      hasMedia: false,
    },
    // Another top-level contribution
    {
      id: 'msg-3-12',
      author: 'Dad',
      authorId: 'user-dad',
      timestamp: Date.now() - 16 * 60 * 60 * 1000,
      body: 'Thanks for sharing! These photos are making me jealous 😄',
      level: 0, // UNCHANGED: Already a top-level contribution
      parentId: 'msg-3-1',
      hasMedia: false,
    },
  ],
};

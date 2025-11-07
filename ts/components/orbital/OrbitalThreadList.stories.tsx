// Copyright 2025 Orbital
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { OrbitalThreadList } from './OrbitalThreadList';
import type { OrbitalThread } from './OrbitalThreadList';

const { i18n } = window.SignalContext;

const meta: Meta<typeof OrbitalThreadList> = {
  title: 'Components/Orbital/OrbitalThreadList',
  component: OrbitalThreadList,
  args: {
    i18n,
    onThreadClick: action('onThreadClick'),
    onCreateThread: action('onCreateThread'),
  },
};

export default meta;
type Story = StoryObj<typeof OrbitalThreadList>;

// Mock thread data with various states
const mockThreads: ReadonlyArray<OrbitalThread> = [
  {
    id: '1',
    title: 'Summer vacation photos are up!',
    author: 'Mom',
    authorId: 'user-1',
    timestamp: Date.now() - 1000 * 60 * 30, // 30 minutes ago
    replyCount: 5,
    hasMedia: true,
    hasVideo: false,
    hasImage: true,
    isUnread: true,
    lastReplyTimestamp: Date.now() - 1000 * 60 * 5,
    lastReplyAuthor: 'Dad',
    // No avatarUrl - will show placeholder with "M"
  },
  {
    id: '2',
    title: 'Recipe for grandma\'s cookies',
    author: 'Sarah',
    authorId: 'user-2',
    timestamp: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
    replyCount: 12,
    hasMedia: false,
    hasVideo: false,
    hasImage: false,
    isUnread: false,
    lastReplyTimestamp: Date.now() - 1000 * 60 * 45,
    lastReplyAuthor: 'Grandma',
    avatarUrl: 'https://via.placeholder.com/96/9B87F5/FFFFFF?text=S', // Example avatar
  },
  {
    id: '3',
    title: 'Check out this funny video',
    author: 'Alex',
    authorId: 'user-3',
    timestamp: Date.now() - 1000 * 60 * 60 * 5, // 5 hours ago
    replyCount: 3,
    hasMedia: true,
    hasVideo: true,
    hasImage: false,
    isUnread: false,
    // No avatarUrl - will show placeholder with "A"
  },
  {
    id: '4',
    title: 'Planning the family reunion',
    author: 'Uncle Bob',
    authorId: 'user-4',
    timestamp: Date.now() - 1000 * 60 * 60 * 24, // 1 day ago
    replyCount: 8,
    hasMedia: false,
    hasVideo: false,
    hasImage: false,
    isUnread: true,
    lastReplyTimestamp: Date.now() - 1000 * 60 * 60 * 3,
    lastReplyAuthor: 'Aunt Mary',
    // No avatarUrl - will show placeholder with "UB"
  },
  {
    id: '5',
    title: 'Emma\'s first day of school',
    author: 'Jessica',
    authorId: 'user-5',
    timestamp: Date.now() - 1000 * 60 * 60 * 24 * 2, // 2 days ago
    replyCount: 15,
    hasMedia: true,
    hasVideo: true,
    hasImage: true,
    isUnread: false,
    lastReplyTimestamp: Date.now() - 1000 * 60 * 60 * 12,
    lastReplyAuthor: 'Michael',
    avatarUrl: 'https://via.placeholder.com/96/48BB78/FFFFFF?text=J', // Example avatar
  },
  {
    id: '6',
    title: 'Looking for recommendations on camping gear',
    author: 'David',
    authorId: 'user-6',
    timestamp: Date.now() - 1000 * 60 * 60 * 24 * 3, // 3 days ago
    replyCount: 0,
    hasMedia: false,
    hasVideo: false,
    hasImage: false,
    isUnread: false,
    // No avatarUrl - will show placeholder with "D"
  },
];

export const Default: Story = {
  args: {
    threads: mockThreads,
  },
};

export const WithActiveThread: Story = {
  args: {
    threads: mockThreads,
    activeThreadId: '2',
  },
};

export const Empty: Story = {
  args: {
    threads: [],
  },
};

export const SingleThread: Story = {
  args: {
    threads: [mockThreads[0]],
  },
};

export const AllWithPlaceholders: Story = {
  args: {
    threads: mockThreads.map(t => ({ ...t, avatarUrl: undefined })),
  },
};

export const AllWithAvatars: Story = {
  args: {
    threads: mockThreads.map((t, i) => ({
      ...t,
      avatarUrl: `https://via.placeholder.com/96/${['5B9FED', '9B87F5', '48BB78', 'F59E0B', 'F56565', '3D7BC4'][i % 6]}/FFFFFF?text=${t.author.charAt(0)}`,
    })),
  },
};

export const MixedStates: Story = {
  args: {
    threads: mockThreads,
    activeThreadId: '3',
  },
};

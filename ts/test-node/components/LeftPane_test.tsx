// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { assert } from 'chai';

import { LeftPane, RowType, HeaderType } from '../../components/LeftPane';
import { setup as setupI18n } from '../../../js/modules/i18n';
import enMessages from '../../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

describe('LeftPane', () => {
  const defaultProps = {
    archivedConversations: [],
    conversations: [],
    i18n,
    openConversationInternal: () => null,
    pinnedConversations: [],
    renderExpiredBuildDialog: () => <div />,
    renderMainHeader: () => <div />,
    renderMessageSearchResult: () => <div />,
    renderNetworkStatus: () => <div />,
    renderRelinkDialog: () => <div />,
    renderUpdateDialog: () => <div />,
    showArchivedConversations: () => null,
    showInbox: () => null,
    startNewConversation: () => null,
  };

  describe('getRowFromIndex', () => {
    describe('given only pinned chats', () => {
      it('returns pinned chats, not headers', () => {
        const leftPane = new LeftPane({
          ...defaultProps,
          pinnedConversations: [
            {
              id: 'philly-convo',
              isPinned: true,
              isSelected: false,
              lastUpdated: Date.now(),
              markedUnread: false,
              title: 'Philip Glass',
              type: 'direct',
            },
            {
              id: 'robbo-convo',
              isPinned: true,
              isSelected: false,
              lastUpdated: Date.now(),
              markedUnread: false,
              title: 'Robert Moog',
              type: 'direct',
            },
          ],
        });

        assert.deepEqual(leftPane.getRowFromIndex(0), {
          index: 0,
          type: RowType.PinnedConversation,
        });
        assert.deepEqual(leftPane.getRowFromIndex(1), {
          index: 1,
          type: RowType.PinnedConversation,
        });
      });
    });

    describe('given only non-pinned chats', () => {
      it('returns conversations, not headers', () => {
        const leftPane = new LeftPane({
          ...defaultProps,
          conversations: [
            {
              id: 'fred-convo',
              isSelected: false,
              lastUpdated: Date.now(),
              markedUnread: false,
              title: 'Fred Willard',
              type: 'direct',
            },
            {
              id: 'robbo-convo',
              isPinned: false,
              isSelected: false,
              lastUpdated: Date.now(),
              markedUnread: false,
              title: 'Robert Moog',
              type: 'direct',
            },
          ],
        });

        assert.deepEqual(leftPane.getRowFromIndex(0), {
          index: 0,
          type: RowType.Conversation,
        });
        assert.deepEqual(leftPane.getRowFromIndex(1), {
          index: 1,
          type: RowType.Conversation,
        });
      });
    });

    describe('given only pinned and non-pinned chats', () => {
      it('returns headers and conversations', () => {
        const leftPane = new LeftPane({
          ...defaultProps,
          conversations: [
            {
              id: 'fred-convo',
              isSelected: false,
              lastUpdated: Date.now(),
              markedUnread: false,
              title: 'Fred Willard',
              type: 'direct',
            },
          ],
          pinnedConversations: [
            {
              id: 'philly-convo',
              isPinned: true,
              isSelected: false,
              lastUpdated: Date.now(),
              markedUnread: false,
              title: 'Philip Glass',
              type: 'direct',
            },
          ],
        });

        assert.deepEqual(leftPane.getRowFromIndex(0), {
          headerType: HeaderType.Pinned,
          type: RowType.Header,
        });
        assert.deepEqual(leftPane.getRowFromIndex(1), {
          index: 0,
          type: RowType.PinnedConversation,
        });
        assert.deepEqual(leftPane.getRowFromIndex(2), {
          headerType: HeaderType.Chats,
          type: RowType.Header,
        });
        assert.deepEqual(leftPane.getRowFromIndex(3), {
          index: 0,
          type: RowType.Conversation,
        });
      });
    });

    describe('given not showing archive with archived conversation', () => {
      it('returns an archive button last', () => {
        const leftPane = new LeftPane({
          ...defaultProps,
          archivedConversations: [
            {
              id: 'jerry-convo',
              isSelected: false,
              lastUpdated: Date.now(),
              markedUnread: false,
              title: 'Jerry Jordan',
              type: 'direct',
            },
          ],
          conversations: [
            {
              id: 'fred-convo',
              isSelected: false,
              lastUpdated: Date.now(),
              markedUnread: false,
              title: 'Fred Willard',
              type: 'direct',
            },
          ],
          showArchived: false,
        });

        assert.deepEqual(leftPane.getRowFromIndex(1), {
          type: RowType.ArchiveButton,
        });
      });
    });

    describe('given showing archive and archive chats', () => {
      it('returns archived conversations', () => {
        const leftPane = new LeftPane({
          ...defaultProps,
          archivedConversations: [
            {
              id: 'fred-convo',
              isSelected: false,
              lastUpdated: Date.now(),
              markedUnread: false,
              title: 'Fred Willard',
              type: 'direct',
            },
          ],
          showArchived: true,
        });

        assert.deepEqual(leftPane.getRowFromIndex(0), {
          index: 0,
          type: RowType.ArchivedConversation,
        });
      });
    });
  });
});

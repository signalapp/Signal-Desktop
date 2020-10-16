import { expect } from 'chai';

import {
  LeftPane,
  RowType,
  PropsType,
  HeaderType,
} from '../../components/LeftPane';
import { setup as setupI18n } from '../../../js/modules/i18n';
import enMessages from '../../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

describe('LeftPane', () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const defaultProps = {
    archivedConversations: [],
    conversations: [],
    i18n,
    openConversationInternal: () => null,
    pinnedConversations: [],
    renderExpiredBuildDialog: () => '<div />' as any,
    renderMainHeader: () => '<div />' as any,
    renderMessageSearchResult: () => '<div />' as any,
    renderNetworkStatus: () => '<div />' as any,
    renderRelinkDialog: () => '<div />' as any,
    renderUpdateDialog: () => '<div />' as any,
    showArchivedConversations: () => null,
    showInbox: () => null,
    startNewConversation: () => null,
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */

  describe('getRowFromIndex', () => {
    let leftPane: LeftPane;

    describe('with pinned, non-pinned, and archived chats', () => {
      it('returns headers, conversations, and an archived button', () => {
        leftPane = new LeftPane({
          ...defaultProps,
          pinnedConversations: [
            {
              id: 'philly-convo',
              isPinned: true,
              isSelected: false,
              lastUpdated: Date.now(),
              title: 'Philip Glass',
              type: 'direct',
            },
            {
              id: 'robbo-convo',
              isPinned: true,
              isSelected: false,
              lastUpdated: Date.now(),
              title: 'Robert Moog',
              type: 'direct',
            },
          ],
          conversations: [
            {
              id: 'etta-convo',
              isSelected: false,
              lastUpdated: Date.now(),
              title: 'Etta James',
              type: 'direct',
            },
            {
              id: 'kimbra-convo',
              isPinned: false,
              isSelected: false,
              lastUpdated: Date.now(),
              title: 'Kimbra',
              type: 'direct',
            },
          ],
          archivedConversations: [
            {
              id: 'jerry-convo',
              isSelected: false,
              lastUpdated: Date.now(),
              title: 'Jerry Jordan',
              type: 'direct',
            },
          ],
        });

        expect(leftPane.getRowFromIndex(0)).to.eql({
          headerType: HeaderType.Pinned,
          type: RowType.Header,
        });
        expect(leftPane.getRowFromIndex(1)).to.eql({
          index: 0,
          type: RowType.PinnedConversation,
        });
        expect(leftPane.getRowFromIndex(2)).to.eql({
          index: 1,
          type: RowType.PinnedConversation,
        });
        expect(leftPane.getRowFromIndex(3)).to.eql({
          headerType: HeaderType.Chats,
          type: RowType.Header,
        });
        expect(leftPane.getRowFromIndex(4)).to.eql({
          index: 0,
          type: RowType.Conversation,
        });
        expect(leftPane.getRowFromIndex(5)).to.eql({
          index: 1,
          type: RowType.Conversation,
        });
        expect(leftPane.getRowFromIndex(6)).to.eql({
          type: RowType.ArchiveButton,
        });
      });
    });

    describe('given only pinned chats', () => {
      beforeEach(function beforeEach() {
        const props: PropsType = {
          ...defaultProps,
          pinnedConversations: [
            {
              id: 'philly-convo',
              isPinned: true,
              isSelected: false,
              lastUpdated: Date.now(),
              title: 'Philip Glass',
              type: 'direct',
            },
            {
              id: 'robbo-convo',
              isPinned: true,
              isSelected: false,
              lastUpdated: Date.now(),
              title: 'Robert Moog',
              type: 'direct',
            },
          ],
        };
        leftPane = new LeftPane(props);
      });

      it('return pinned chats, not headers', () => {
        expect(leftPane.getRowFromIndex(0)).to.eql({
          index: 0,
          type: RowType.PinnedConversation,
        });

        expect(leftPane.getRowFromIndex(1)).to.eql({
          index: 1,
          type: RowType.PinnedConversation,
        });
      });
    });

    describe('given only non-pinned chats', () => {
      it('returns conversations, not headers', () => {
        const props: PropsType = {
          ...defaultProps,
          conversations: [
            {
              id: 'fred-convo',
              isSelected: false,
              lastUpdated: Date.now(),
              title: 'Fred Willard',
              type: 'direct',
            },
            {
              id: 'robbo-convo',
              isPinned: false,
              isSelected: false,
              lastUpdated: Date.now(),
              title: 'Robert Moog',
              type: 'direct',
            },
          ],
        };
        leftPane = new LeftPane(props);

        expect(leftPane.getRowFromIndex(0)).to.eql({
          index: 0,
          type: RowType.Conversation,
        });

        expect(leftPane.getRowFromIndex(1)).to.eql({
          index: 1,
          type: RowType.Conversation,
        });
      });
    });

    describe('given only pinned and non-pinned chats', () => {
      beforeEach(function beforeEach() {
        const props: PropsType = {
          ...defaultProps,
          conversations: [
            {
              id: 'fred-convo',
              isSelected: false,
              lastUpdated: Date.now(),
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
              title: 'Philip Glass',
              type: 'direct',
            },
          ],
        };
        leftPane = new LeftPane(props);
      });

      it('returns headers and conversations', () => {
        expect(leftPane.getRowFromIndex(0)).to.eql({
          headerType: HeaderType.Pinned,
          type: RowType.Header,
        });

        expect(leftPane.getRowFromIndex(1)).to.eql({
          index: 0,
          type: RowType.PinnedConversation,
        });

        expect(leftPane.getRowFromIndex(2)).to.eql({
          headerType: HeaderType.Chats,
          type: RowType.Header,
        });

        expect(leftPane.getRowFromIndex(3)).to.eql({
          index: 0,
          type: RowType.Conversation,
        });
      });
    });

    describe('given only pinned and archived chats', () => {
      it('shows the pinned chats with no headers', () => {
        leftPane = new LeftPane({
          ...defaultProps,
          pinnedConversations: [
            {
              id: 'philly-convo',
              isPinned: true,
              isSelected: false,
              lastUpdated: Date.now(),
              title: 'Philip Glass',
              type: 'direct',
            },
          ],
          archivedConversations: [
            {
              id: 'fred-convo',
              isSelected: false,
              lastUpdated: Date.now(),
              title: 'Fred Willard',
              type: 'direct',
            },
          ],
        });

        expect(leftPane.getRowFromIndex(0)).to.eql({
          index: 0,
          type: RowType.PinnedConversation,
        });

        expect(leftPane.getRowFromIndex(1)).to.eql({
          type: RowType.ArchiveButton,
        });
      });
    });

    describe("given only archived conversations, which we're not showing", () => {
      it('returns a single row, the archive button', () => {
        leftPane = new LeftPane({
          ...defaultProps,
          archivedConversations: [
            {
              id: 'jerry-convo',
              isSelected: false,
              lastUpdated: Date.now(),
              title: 'Jerry Jordan',
              type: 'direct',
            },
          ],
          showArchived: false,
        });

        expect(leftPane.getRowFromIndex(0)).to.eql({
          type: RowType.ArchiveButton,
        });
      });
    });

    describe('given not showing archive with archived conversation', () => {
      beforeEach(function beforeEach() {
        const props: PropsType = {
          ...defaultProps,
          archivedConversations: [
            {
              id: 'jerry-convo',
              isSelected: false,
              lastUpdated: Date.now(),
              title: 'Jerry Jordan',
              type: 'direct',
            },
          ],
          conversations: [
            {
              id: 'fred-convo',
              isSelected: false,
              lastUpdated: Date.now(),
              title: 'Fred Willard',
              type: 'direct',
            },
          ],
          showArchived: false,
        };

        leftPane = new LeftPane(props);
      });

      it('returns an archive button last', () => {
        expect(leftPane.getRowFromIndex(1)).to.eql({
          type: RowType.ArchiveButton,
        });
      });
    });

    describe('given showing archive and archive chats', () => {
      beforeEach(function beforeEach() {
        const props: PropsType = {
          ...defaultProps,
          archivedConversations: [
            {
              id: 'fred-convo',
              isSelected: false,
              lastUpdated: Date.now(),
              title: 'Fred Willard',
              type: 'direct',
            },
          ],
          showArchived: true,
        };

        leftPane = new LeftPane(props);
      });

      it('returns archived conversations', () => {
        expect(leftPane.getRowFromIndex(0)).to.eql({
          index: 0,
          type: RowType.ArchivedConversation,
        });
      });
    });
  });
});

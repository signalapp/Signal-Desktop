import * as React from 'react';

import { action } from '@storybook/addon-actions';
import { boolean, text } from '@storybook/addon-knobs';
import { storiesOf } from '@storybook/react';

import { LeftPane, PropsType } from './LeftPane';
import { PropsData } from './ConversationListItem';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/LeftPane', module);

const defaultConversations: Array<PropsData> = [
  {
    id: 'fred-convo',
    isSelected: false,
    lastUpdated: Date.now(),
    title: 'Fred Willard',
    type: 'direct',
  },
  {
    id: 'marc-convo',
    isSelected: true,
    lastUpdated: Date.now(),
    title: 'Marc Barraca',
    type: 'direct',
  },
];

const defaultArchivedConversations: Array<PropsData> = [
  {
    id: 'michelle-archive-convo',
    isSelected: false,
    lastUpdated: Date.now(),
    title: 'Michelle Mercure',
    type: 'direct',
  },
];

const pinnedConversations: Array<PropsData> = [
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
];

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  archivedConversations:
    overrideProps.archivedConversations || defaultArchivedConversations,
  conversations: overrideProps.conversations || defaultConversations,
  i18n,
  openConversationInternal: action('openConversationInternal'),
  pinnedConversations: overrideProps.pinnedConversations || [],
  renderExpiredBuildDialog: () => <div />,
  renderMainHeader: () => <div />,
  renderMessageSearchResult: () => <div />,
  renderNetworkStatus: () => <div />,
  renderRelinkDialog: () => <div />,
  renderUpdateDialog: () => <div />,
  searchResults: overrideProps.searchResults,
  selectedConversationId: text(
    'selectedConversationId',
    overrideProps.selectedConversationId || null
  ),
  showArchived: boolean('showArchived', overrideProps.showArchived || false),
  showArchivedConversations: action('showArchivedConversations'),
  showInbox: action('showInbox'),
  startNewConversation: action('startNewConversation'),
});

story.add('Conversation States (Active, Selected, Archived)', () => {
  const props = createProps();

  return <LeftPane {...props} />;
});

story.add('Pinned and Non-pinned Conversations', () => {
  const props = createProps({
    pinnedConversations,
  });

  return <LeftPane {...props} />;
});

story.add('Only Pinned Conversations', () => {
  const props = createProps({
    archivedConversations: [],
    conversations: [],
    pinnedConversations,
  });

  return <LeftPane {...props} />;
});

story.add('Archived Conversations Shown', () => {
  const props = createProps({
    showArchived: true,
  });
  return <LeftPane {...props} />;
});

story.add('Search Results', () => {
  const props = createProps({
    searchResults: {
      discussionsLoading: false,
      items: [
        {
          type: 'conversations-header',
          data: undefined,
        },
        {
          type: 'conversation',
          data: {
            id: 'fred-convo',
            isSelected: false,
            lastUpdated: Date.now(),
            title: 'People Named Fred',
            type: 'group',
          },
        },
        {
          type: 'start-new-conversation',
          data: undefined,
        },
        {
          type: 'contacts-header',
          data: undefined,
        },
        {
          type: 'contact',
          data: {
            id: 'fred-contact',
            isSelected: false,
            lastUpdated: Date.now(),
            title: 'Fred Willard',
            type: 'direct',
          },
        },
      ],
      messagesLoading: false,
      noResults: false,
      regionCode: 'en',
      searchTerm: 'Fred',
    },
  });

  return <LeftPane {...props} />;
});

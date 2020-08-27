import * as React from 'react';

import { text } from '@storybook/addon-knobs';
import { storiesOf } from '@storybook/react';

import { ConversationSearch, Props } from './ConversationSearch';

import { ConversationType } from '../sql/Interface';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';
import { ReplacementValuesType } from '../types/I18N';

const story = storiesOf('Components/ConversationSearch', module);
const i18n = setupI18n('en', enMessages);

const createProps = (
  overrideProps: Partial<Props> = {}
): {
  searchTerm: string;
  width: string | undefined;
  caption: string;
  onConversationSelected: (conversationId: string) => void;
  searchConversationsFn: (
    query?: string,
    options?: { limit?: number }
  ) => Promise<Array<ConversationType>>;
  i18n: (
    key: string,
    values?: Array<string> | ReplacementValuesType<string>
  ) => string;
  height: string;
} => ({
  caption: text('caption', overrideProps.caption || ''),
  searchTerm: '',
  i18n,
  // if width is not set it will keep the default value set by the component
  width: overrideProps.width,
  height: overrideProps.height ? overrideProps.height : '500px',
  onConversationSelected: () => ({}),
  searchConversationsFn:
    overrideProps.searchConversationsFn || (async () => Promise.resolve([])),
});

story.add('[No Caption - No Height]', () => {
  const props = createProps({
    height: undefined,
  });

  return <ConversationSearch {...props} />;
});

story.add('[With Caption - No Height]', () => {
  const props = createProps({
    caption: 'Search Conversations',
    height: undefined,
  });

  return <ConversationSearch {...props} />;
});

story.add('[No Caption - No Data]', () => {
  const props = createProps({});

  return <ConversationSearch {...props} />;
});

story.add('[With Caption - No Data]', () => {
  const props = createProps({
    caption: 'Search Conversations',
  });

  return <ConversationSearch {...props} />;
});

story.add('[With Caption - With Data]', () => {
  const testData: ConversationType = [];
  for (let i = 1; i < 10; i += 1) {
    testData.push({
      id: `${i}`,
      type: 'group',
      lastUpdate: 5,
      title: `Conversation ${i}`,
    });
  }

  const props = createProps({
    caption: 'Search Conversations',
    searchConversationsFn: async () => Promise.resolve(getTestData()),
  });

  return <ConversationSearch {...props} />;
});

story.add('[No Caption - With Data]', () => {
  const props = createProps({
    searchConversationsFn: async () => Promise.resolve(getTestData()),
  });

  return <ConversationSearch {...props} />;
});

story.add('[With Data - With Width]', () => {
  const props = createProps({
    width: '180px',
    searchConversationsFn: async () => Promise.resolve(getTestData(3)),
  });

  return <ConversationSearch {...props} />;
});

function getTestData(num = 10) {
  const testData: ConversationType = [];
  for (let i = 1; i <= num; i += 1) {
    testData.push({
      id: `${i}`,
      type: 'group',
      lastUpdate: 5,
      title: `Conversation ${i}`,
    });
  }
  return testData;
}

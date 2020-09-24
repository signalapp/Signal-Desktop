import * as React from 'react';

import 'draft-js/dist/Draft.css';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { boolean, date, select, text } from '@storybook/addon-knobs';

import {
  ConversationListItem,
  MessageStatuses,
  Props,
} from './ConversationListItem';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/ConversationListItem', module);

story.addDecorator(storyFn => (
  <div style={{ width: '300px' }}>{storyFn()}</div>
));

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  ...overrideProps,
  i18n,
  isAccepted: boolean(
    'isAccepted',
    overrideProps.isAccepted !== undefined ? overrideProps.isAccepted : true
  ),
  isMe: boolean('isMe', overrideProps.isMe || false),
  avatarPath: text('avatarPath', overrideProps.avatarPath || ''),
  id: overrideProps.id || '',
  isSelected: boolean('isSelected', overrideProps.isSelected || false),
  title: text('title', overrideProps.title || 'Some Person'),
  name: overrideProps.name || 'Some Person',
  type: overrideProps.type || 'direct',
  onClick: action('onClick'),
  lastMessage: overrideProps.lastMessage || {
    text: text('lastMessage.text', 'Hi there!'),
    status: select(
      'status',
      MessageStatuses.reduce((m, s) => ({ ...m, [s]: s }), {}),
      'read'
    ),
  },
  lastUpdated: date(
    'lastUpdated',
    new Date(overrideProps.lastUpdated || Date.now() - 5 * 60 * 1000)
  ),
});

story.add('Name', () => {
  const props = createProps();

  return <ConversationListItem {...props} />;
});

story.add('Name and Avatar', () => {
  const props = createProps({
    avatarPath: '/fixtures/kitten-1-64-64.jpg',
  });

  return <ConversationListItem {...props} />;
});

story.add('Conversation with Yourself', () => {
  const props = createProps({
    lastMessage: {
      text: 'Just a second',
      status: 'read',
    },
    name: 'Myself',
    title: 'Myself',
    isMe: true,
  });

  return <ConversationListItem {...props} />;
});

story.add('Message Statuses', () => {
  return MessageStatuses.map(status => {
    const props = createProps({
      lastMessage: {
        text: status,
        status,
      },
    });

    return <ConversationListItem key={status} {...props} />;
  });
});

story.add('Typing Status', () => {
  const props = createProps({
    typingContact: {
      name: 'Someone Here',
    },
  });

  return <ConversationListItem {...props} />;
});

story.add('Message Request', () => {
  const props = createProps({
    isAccepted: false,
    lastMessage: {
      text: 'A Message',
      status: 'delivered',
    },
  });

  return <ConversationListItem {...props} />;
});

story.add('Unread', () => {
  const counts = [4, 10, 250];

  return counts.map(unreadCount => {
    const props = createProps({
      lastMessage: {
        text: 'Hey there!',
        status: 'delivered',
      },
      unreadCount,
    });

    return <ConversationListItem key={unreadCount} {...props} />;
  });
});

story.add('Selected', () => {
  const props = createProps({
    lastMessage: {
      text: 'Hey there!',
      status: 'read',
    },
    isSelected: true,
  });

  return <ConversationListItem {...props} />;
});

story.add('Emoji in Message', () => {
  const props = createProps({
    lastMessage: {
      text: '🔥',
      status: 'read',
    },
  });

  return <ConversationListItem {...props} />;
});

story.add('Link in Message', () => {
  const props = createProps({
    lastMessage: {
      text: 'Download at http://signal.org',
      status: 'read',
    },
  });

  return <ConversationListItem {...props} />;
});

story.add('Long Name', () => {
  const name =
    'Long contact name. Esquire. The third. And stuff. And more! And more!';

  const props = createProps({
    name,
    title: name,
  });

  return <ConversationListItem {...props} />;
});

story.add('Long Message', () => {
  const messages = [
    "Long line. This is a really really really long line. Really really long. Because that's just how it is",
    `Many lines. This is a many-line message.
Line 2 is really exciting but it shouldn't be seen.
Line three is even better.
Line 4, well.`,
  ];

  return messages.map(message => {
    const props = createProps({
      lastMessage: {
        text: message,
        status: 'read',
      },
    });

    return <ConversationListItem key={message.length} {...props} />;
  });
});

story.add('Various Times', () => {
  const times: Array<[number, string]> = [
    [Date.now() - 5 * 60 * 60 * 1000, 'Five hours ago'],
    [Date.now() - 24 * 60 * 60 * 1000, 'One day ago'],
    [Date.now() - 7 * 24 * 60 * 60 * 1000, 'One week ago'],
    [Date.now() - 365 * 24 * 60 * 60 * 1000, 'One year ago'],
  ];

  return times.map(([lastUpdated, messageText]) => {
    const props = createProps({
      lastUpdated,
      lastMessage: {
        text: messageText,
        status: 'read',
      },
    });

    return <ConversationListItem key={lastUpdated} {...props} />;
  });
});

story.add('Missing Date', () => {
  const props = createProps();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <ConversationListItem {...props} lastUpdated={undefined as any} />;
});

story.add('Missing Message', () => {
  const props = createProps();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <ConversationListItem {...props} lastMessage={undefined as any} />;
});

story.add('Missing Text', () => {
  const props = createProps();

  return (
    <ConversationListItem
      {...props}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lastMessage={{ text: undefined as any, status: 'sent' }}
    />
  );
});

story.add('Muted Conversation', () => {
  const props = createProps();
  const muteExpiresAt = Date.now() + 1000 * 60 * 60;

  return <ConversationListItem {...props} muteExpiresAt={muteExpiresAt} />;
});

story.add('At Mention', () => {
  const props = createProps({
    title: 'The Rebellion',
    type: 'group',
    lastMessage: {
      text: '@Leia Organa I know',
      status: 'read',
    },
  });

  return <ConversationListItem {...props} />;
});

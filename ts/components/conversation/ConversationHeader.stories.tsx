import * as React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

// @ts-ignore
import { setup as setupI18n } from '../../../js/modules/i18n';
// @ts-ignore
import enMessages from '../../../\_locales/en/messages.json';

import {
  ConversationHeader,
  Props,
  PropsActions,
  PropsHousekeeping,
} from './ConversationHeader';

import { gifObjectUrl } from '../../storybook/Fixtures';

const book = storiesOf('Components/Conversation/ConversationHeader', module);
const i18n = setupI18n('en', enMessages);

type ConversationHeaderStory = {
  title: string;
  description: string;
  items: Array<{
    title: string;
    props: Props;
  }>;
};

const actionProps: PropsActions = {
  onSetDisappearingMessages: action('onSetDisappearingMessages'),
  onDeleteMessages: action('onDeleteMessages'),
  onResetSession: action('onResetSession'),
  onSearchInConversation: action('onSearchInConversation'),

  onShowSafetyNumber: action('onShowSafetyNumber'),
  onShowAllMedia: action('onShowAllMedia'),
  onShowGroupMembers: action('onShowGroupMembers'),
  onGoBack: action('onGoBack'),

  onArchive: action('onArchive'),
  onMoveToInbox: action('onMoveToInbox'),
};

const housekeepingProps: PropsHousekeeping = {
  i18n,
};

const stories: Array<ConversationHeaderStory> = [
  {
    title: '1:1 conversation',
    description:
      "Note the five items in menu, and the second-level menu with disappearing messages options. Disappearing message set to 'off'.",
    items: [
      {
        title: 'With name and profile, verified',
        props: {
          color: 'red',
          isVerified: true,
          avatarPath: gifObjectUrl,
          name: 'Someone 🔥 Somewhere',
          phoneNumber: '(202) 555-0001',
          id: '1',
          profileName: '🔥Flames🔥',
          ...actionProps,
          ...housekeepingProps,
        },
      },
      {
        title: 'With name, not verified, no avatar',
        props: {
          color: 'blue',
          isVerified: false,
          name: 'Someone 🔥 Somewhere',
          phoneNumber: '(202) 555-0002',
          id: '2',
          ...actionProps,
          ...housekeepingProps,
        },
      },
      {
        title: 'Profile, no name',
        props: {
          color: 'teal',
          isVerified: false,
          phoneNumber: '(202) 555-0003',
          id: '3',
          profileName: '🔥Flames🔥',
          ...actionProps,
          ...housekeepingProps,
        },
      },
      {
        title: 'No name, no profile, no color',
        props: {
          phoneNumber: '(202) 555-0011',
          id: '11',
          ...actionProps,
          ...housekeepingProps,
        },
      },
      {
        title: 'With back button',
        props: {
          showBackButton: true,
          color: 'deep_orange',
          phoneNumber: '(202) 555-0004',
          id: '4',
          ...actionProps,
          ...housekeepingProps,
        },
      },
      {
        title: 'Disappearing messages set',
        props: {
          color: 'indigo',
          phoneNumber: '(202) 555-0005',
          id: '5',
          expirationSettingName: '10 seconds',
          timerOptions: [
            {
              name: 'off',
              value: 0,
            },
            {
              name: '10 seconds',
              value: 10,
            },
          ],
          ...actionProps,
          ...housekeepingProps,
        },
      },
    ],
  },
  {
    title: 'In a group',
    description:
      "Note that the menu should includes 'Show Members' instead of 'Show Safety Number'",
    items: [
      {
        title: 'Basic',
        props: {
          color: 'signal-blue',
          name: 'Typescript support group',
          phoneNumber: '',
          id: '1',
          isGroup: true,
          expirationSettingName: '10 seconds',
          timerOptions: [
            {
              name: 'off',
              value: 0,
            },
            {
              name: '10 seconds',
              value: 10,
            },
          ],
          ...actionProps,
          ...housekeepingProps,
        },
      },
      {
        title: 'In a group you left - no disappearing messages',
        props: {
          color: 'signal-blue',
          name: 'Typescript support group',
          phoneNumber: '',
          id: '2',
          isGroup: true,
          leftGroup: true,
          expirationSettingName: '10 seconds',
          timerOptions: [
            {
              name: 'off',
              value: 0,
            },
            {
              name: '10 seconds',
              value: 10,
            },
          ],
          ...actionProps,
          ...housekeepingProps,
        },
      },
    ],
  },
  {
    title: 'Note to Self',
    description: 'No safety number entry.',
    items: [
      {
        title: 'In chat with yourself',
        props: {
          color: 'blue',
          phoneNumber: '(202) 555-0007',
          id: '7',
          isMe: true,
          ...actionProps,
          ...housekeepingProps,
        },
      },
    ],
  },
];

stories.forEach(({ title, description, items }) =>
  book.add(
    title,
    () =>
      items.map(({ title: subtitle, props }, i) => {
        return (
          <div key={i}>
            {subtitle ? <h3>{subtitle}</h3> : null}
            <ConversationHeader {...props} />
          </div>
        );
      }),
    {
      docs: description,
    }
  )
);

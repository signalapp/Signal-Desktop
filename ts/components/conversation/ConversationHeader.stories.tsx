import * as React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { setup as setupI18n } from '../../../js/modules/i18n';
import enMessages from '../../../_locales/en/messages.json';
import {
  ConversationHeader,
  PropsActionsType,
  PropsHousekeepingType,
  PropsType,
} from './ConversationHeader';
import { gifUrl } from '../../storybook/Fixtures';

const book = storiesOf('Components/Conversation/ConversationHeader', module);
const i18n = setupI18n('en', enMessages);

type ConversationHeaderStory = {
  title: string;
  description: string;
  items: Array<{
    title: string;
    props: PropsType;
  }>;
};

const actionProps: PropsActionsType = {
  onSetDisappearingMessages: action('onSetDisappearingMessages'),
  onDeleteMessages: action('onDeleteMessages'),
  onResetSession: action('onResetSession'),
  onSearchInConversation: action('onSearchInConversation'),
  onSetMuteNotifications: action('onSetMuteNotifications'),
  onOutgoingAudioCallInConversation: action(
    'onOutgoingAudioCallInConversation'
  ),
  onOutgoingVideoCallInConversation: action(
    'onOutgoingVideoCallInConversation'
  ),

  onShowSafetyNumber: action('onShowSafetyNumber'),
  onShowAllMedia: action('onShowAllMedia'),
  onShowGroupMembers: action('onShowGroupMembers'),
  onGoBack: action('onGoBack'),

  onArchive: action('onArchive'),
  onMoveToInbox: action('onMoveToInbox'),
  onSetPin: action('onSetPin'),
};

const housekeepingProps: PropsHousekeepingType = {
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
          avatarPath: gifUrl,
          title: 'Someone 🔥 Somewhere',
          name: 'Someone 🔥 Somewhere',
          phoneNumber: '(202) 555-0001',
          type: 'direct',
          id: '1',
          profileName: '🔥Flames🔥',
          isAccepted: true,
          ...actionProps,
          ...housekeepingProps,
        },
      },
      {
        title: 'With name, not verified, no avatar',
        props: {
          color: 'blue',
          isVerified: false,
          title: 'Someone 🔥 Somewhere',
          name: 'Someone 🔥 Somewhere',
          phoneNumber: '(202) 555-0002',
          type: 'direct',
          id: '2',
          isAccepted: true,
          ...actionProps,
          ...housekeepingProps,
        },
      },
      {
        title: 'With name, not verified, descenders',
        props: {
          color: 'blue',
          isVerified: false,
          title: 'Joyrey 🔥 Leppey',
          name: 'Joyrey 🔥 Leppey',
          phoneNumber: '(202) 555-0002',
          type: 'direct',
          id: '2',
          isAccepted: true,
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
          type: 'direct',
          id: '3',
          title: '🔥Flames🔥',
          profileName: '🔥Flames🔥',
          isAccepted: true,
          ...actionProps,
          ...housekeepingProps,
        },
      },
      {
        title: 'No name, no profile, no color',
        props: {
          title: '(202) 555-0011',
          phoneNumber: '(202) 555-0011',
          type: 'direct',
          id: '11',
          isAccepted: true,
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
          title: '(202) 555-0004',
          type: 'direct',
          id: '4',
          isAccepted: true,
          ...actionProps,
          ...housekeepingProps,
        },
      },
      {
        title: 'Disappearing messages set',
        props: {
          color: 'indigo',
          title: '(202) 555-0005',
          phoneNumber: '(202) 555-0005',
          type: 'direct',
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
          isAccepted: true,
          ...actionProps,
          ...housekeepingProps,
        },
      },
      {
        title: 'Muting Conversation',
        props: {
          color: 'ultramarine',
          title: '(202) 555-0006',
          phoneNumber: '(202) 555-0006',
          type: 'direct',
          id: '6',
          muteExpirationLabel: '10/18/3000, 11:11 AM',
          isAccepted: true,
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
          title: 'Typescript support group',
          name: 'Typescript support group',
          phoneNumber: '',
          id: '1',
          type: 'group',
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
          isAccepted: true,
          ...actionProps,
          ...housekeepingProps,
        },
      },
      {
        title: 'In a group you left - no disappearing messages',
        props: {
          color: 'signal-blue',
          title: 'Typescript support group',
          name: 'Typescript support group',
          phoneNumber: '',
          id: '2',
          type: 'group',
          disableTimerChanges: true,
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
          isAccepted: true,
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
          title: '(202) 555-0007',
          phoneNumber: '(202) 555-0007',
          id: '7',
          type: 'direct',
          isMe: true,
          isAccepted: true,
          ...actionProps,
          ...housekeepingProps,
        },
      },
    ],
  },
  {
    title: 'Unaccepted',
    description: 'No safety number entry.',
    items: [
      {
        title: '1:1 conversation',
        props: {
          color: 'blue',
          title: '(202) 555-0007',
          phoneNumber: '(202) 555-0007',
          id: '7',
          type: 'direct',
          isMe: false,
          isAccepted: false,
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

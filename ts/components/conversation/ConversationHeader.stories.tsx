// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ComponentProps } from 'react';
import React, { useContext } from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { getDefaultConversation } from '../../test-both/helpers/getDefaultConversation';
import { getRandomColor } from '../../test-both/helpers/getRandomColor';
import { setupI18n } from '../../util/setupI18n';
import { DurationInSeconds } from '../../util/durations';
import enMessages from '../../../_locales/en/messages.json';
import { StorybookThemeContext } from '../../../.storybook/StorybookThemeContext';
import type { PropsType } from './ConversationHeader';
import {
  ConversationHeader,
  OutgoingCallButtonStyle,
} from './ConversationHeader';
import { gifUrl } from '../../storybook/Fixtures';

export default {
  title: 'Components/Conversation/ConversationHeader',
} satisfies Meta<PropsType>;

const i18n = setupI18n('en', enMessages);

type ItemsType = Array<{
  title: string;
  props: Omit<ComponentProps<typeof ConversationHeader>, 'theme'>;
}>;

const commonProps = {
  ...getDefaultConversation(),

  cannotLeaveBecauseYouAreLastAdmin: false,
  showBackButton: false,
  outgoingCallButtonStyle: OutgoingCallButtonStyle.Both,
  isSelectMode: false,

  i18n,

  setDisappearingMessages: action('setDisappearingMessages'),
  destroyMessages: action('destroyMessages'),
  leaveGroup: action('leaveGroup'),
  onOutgoingAudioCallInConversation: action(
    'onOutgoingAudioCallInConversation'
  ),
  onOutgoingVideoCallInConversation: action(
    'onOutgoingVideoCallInConversation'
  ),

  onArchive: action('onArchive'),
  onMarkUnread: action('onMarkUnread'),
  toggleSelectMode: action('toggleSelectMode'),
  onMoveToInbox: action('onMoveToInbox'),
  pushPanelForConversation: action('pushPanelForConversation'),
  popPanelForConversation: action('popPanelForConversation'),
  searchInConversation: action('searchInConversation'),
  setMuteExpiration: action('onSetMuteNotifications'),
  setPinned: action('setPinned'),
  viewUserStories: action('viewUserStories'),
};

export function PrivateConvo(): JSX.Element {
  const items: ItemsType = [
    {
      title: 'With name and profile, verified',
      props: {
        ...commonProps,
        color: getRandomColor(),
        isVerified: true,
        avatarPath: gifUrl,
        title: 'Someone 🔥 Somewhere',
        name: 'Someone 🔥 Somewhere',
        phoneNumber: '(202) 555-0001',
        type: 'direct',
        id: '1',
        profileName: '🔥Flames🔥',
        acceptedMessageRequest: true,
      },
    },
    {
      title: 'With name, not verified, no avatar',
      props: {
        ...commonProps,
        color: getRandomColor(),
        isVerified: false,
        title: 'Someone 🔥 Somewhere',
        name: 'Someone 🔥 Somewhere',
        phoneNumber: '(202) 555-0002',
        type: 'direct',
        id: '2',
        acceptedMessageRequest: true,
      },
    },
    {
      title: 'With name, not verified, descenders',
      props: {
        ...commonProps,
        color: getRandomColor(),
        isVerified: false,
        title: 'Joyrey 🔥 Leppey',
        name: 'Joyrey 🔥 Leppey',
        phoneNumber: '(202) 555-0002',
        type: 'direct',
        id: '3',
        acceptedMessageRequest: true,
      },
    },
    {
      title: 'Profile, no name',
      props: {
        ...commonProps,
        color: getRandomColor(),
        isVerified: false,
        phoneNumber: '(202) 555-0003',
        type: 'direct',
        id: '4',
        title: '🔥Flames🔥',
        profileName: '🔥Flames🔥',
        acceptedMessageRequest: true,
      },
    },
    {
      title: 'No name, no profile, no color',
      props: {
        ...commonProps,
        title: '(202) 555-0011',
        phoneNumber: '(202) 555-0011',
        type: 'direct',
        id: '5',
        acceptedMessageRequest: true,
      },
    },
    {
      title: 'With back button',
      props: {
        ...commonProps,
        showBackButton: true,
        color: getRandomColor(),
        phoneNumber: '(202) 555-0004',
        title: '(202) 555-0004',
        type: 'direct',
        id: '6',
        acceptedMessageRequest: true,
      },
    },
    {
      title: 'Disappearing messages set',
      props: {
        ...commonProps,
        color: getRandomColor(),
        title: '(202) 555-0005',
        phoneNumber: '(202) 555-0005',
        type: 'direct',
        id: '7',
        expireTimer: DurationInSeconds.fromSeconds(10),
        acceptedMessageRequest: true,
      },
    },
    {
      title: 'Disappearing messages + verified',
      props: {
        ...commonProps,
        color: getRandomColor(),
        title: '(202) 555-0005',
        phoneNumber: '(202) 555-0005',
        type: 'direct',
        id: '8',
        expireTimer: DurationInSeconds.fromSeconds(300),
        acceptedMessageRequest: true,
        isVerified: true,
        canChangeTimer: true,
      },
    },
    {
      title: 'Muting Conversation',
      props: {
        ...commonProps,
        color: getRandomColor(),
        title: '(202) 555-0006',
        phoneNumber: '(202) 555-0006',
        type: 'direct',
        id: '9',
        acceptedMessageRequest: true,
        muteExpiresAt: new Date('3000-10-18T11:11:11Z').valueOf(),
      },
    },
    {
      title: 'SMS-only conversation',
      props: {
        ...commonProps,
        color: getRandomColor(),
        title: '(202) 555-0006',
        phoneNumber: '(202) 555-0006',
        type: 'direct',
        id: '10',
        acceptedMessageRequest: true,
        isSMSOnly: true,
      },
    },
  ];

  const theme = useContext(StorybookThemeContext);

  return (
    <>
      {items.map(({ title: subtitle, props }, i) => {
        return (
          <div key={i}>
            {subtitle ? <h3>{subtitle}</h3> : null}
            <ConversationHeader {...props} theme={theme} />
          </div>
        );
      })}
    </>
  );
}

export function Group(): JSX.Element {
  const items: ItemsType = [
    {
      title: 'Basic',
      props: {
        ...commonProps,
        color: getRandomColor(),
        title: 'Typescript support group',
        name: 'Typescript support group',
        phoneNumber: '',
        id: '11',
        type: 'group',
        expireTimer: DurationInSeconds.fromSeconds(10),
        acceptedMessageRequest: true,
        outgoingCallButtonStyle: OutgoingCallButtonStyle.JustVideo,
      },
    },
    {
      title: 'In a group you left - no disappearing messages',
      props: {
        ...commonProps,
        color: getRandomColor(),
        title: 'Typescript support group',
        name: 'Typescript support group',
        phoneNumber: '',
        id: '12',
        type: 'group',
        left: true,
        expireTimer: DurationInSeconds.fromSeconds(10),
        acceptedMessageRequest: true,
        outgoingCallButtonStyle: OutgoingCallButtonStyle.JustVideo,
      },
    },
    {
      title: 'In a group with an active group call',
      props: {
        ...commonProps,
        color: getRandomColor(),
        title: 'Typescript support group',
        name: 'Typescript support group',
        phoneNumber: '',
        id: '13',
        type: 'group',
        expireTimer: DurationInSeconds.fromSeconds(10),
        acceptedMessageRequest: true,
        outgoingCallButtonStyle: OutgoingCallButtonStyle.Join,
      },
    },
    {
      title: 'In a forever muted group',
      props: {
        ...commonProps,
        color: getRandomColor(),
        title: 'Way too many messages',
        name: 'Way too many messages',
        phoneNumber: '',
        id: '14',
        type: 'group',
        expireTimer: DurationInSeconds.fromSeconds(10),
        acceptedMessageRequest: true,
        outgoingCallButtonStyle: OutgoingCallButtonStyle.JustVideo,
        muteExpiresAt: Infinity,
      },
    },
  ];

  const theme = useContext(StorybookThemeContext);

  return (
    <>
      {items.map(({ title: subtitle, props }, i) => {
        return (
          <div key={i}>
            {subtitle ? <h3>{subtitle}</h3> : null}
            <ConversationHeader {...props} theme={theme} />
          </div>
        );
      })}
    </>
  );
}

export function NoteToSelf(): JSX.Element {
  const items: ItemsType = [
    {
      title: 'In chat with yourself',
      props: {
        ...commonProps,
        color: getRandomColor(),
        title: '(202) 555-0007',
        phoneNumber: '(202) 555-0007',
        id: '15',
        type: 'direct',
        isMe: true,
        acceptedMessageRequest: true,
        outgoingCallButtonStyle: OutgoingCallButtonStyle.None,
      },
    },
  ];

  const theme = useContext(StorybookThemeContext);

  return (
    <>
      {items.map(({ title: subtitle, props }, i) => {
        return (
          <div key={i}>
            {subtitle ? <h3>{subtitle}</h3> : null}
            <ConversationHeader {...props} theme={theme} />
          </div>
        );
      })}
    </>
  );
}

export function Unaccepted(): JSX.Element {
  const items: ItemsType = [
    {
      title: '1:1 conversation',
      props: {
        ...commonProps,
        color: getRandomColor(),
        title: '(202) 555-0007',
        phoneNumber: '(202) 555-0007',
        id: '16',
        type: 'direct',
        isMe: false,
        acceptedMessageRequest: false,
        outgoingCallButtonStyle: OutgoingCallButtonStyle.None,
      },
    },
  ];

  const theme = useContext(StorybookThemeContext);

  return (
    <>
      {items.map(({ title: subtitle, props }, i) => {
        return (
          <div key={i}>
            {subtitle ? <h3>{subtitle}</h3> : null}
            <ConversationHeader {...props} theme={theme} />
          </div>
        );
      })}
    </>
  );
}

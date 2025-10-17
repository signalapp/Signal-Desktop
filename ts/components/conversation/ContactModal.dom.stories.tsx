// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, StoryFn } from '@storybook/react';
import * as React from 'react';
import casual from 'casual';
import { action } from '@storybook/addon-actions';
import type { ConversationType } from '../../state/ducks/conversations.preload.js';
import type { PropsType } from './ContactModal.dom.js';
import { ContactModal } from './ContactModal.dom.js';
import { HasStories } from '../../types/Stories.std.js';
import { ThemeType } from '../../types/Util.std.js';
import { getDefaultConversation } from '../../test-helpers/getDefaultConversation.std.js';
import { getFakeBadges } from '../../test-helpers/getFakeBadge.std.js';

const { i18n } = window.SignalContext;

const defaultContact: ConversationType = getDefaultConversation({
  about: '👍 Free to chat',
});

const defaultGroup: ConversationType = getDefaultConversation({
  areWeAdmin: true,
  groupLink: casual.url,
  title: casual.title,
  type: 'group',
});

export default {
  title: 'Components/Conversation/ContactModal',
  component: ContactModal,
  argTypes: {
    hasActiveCall: { control: { type: 'boolean' } },
  },
  args: {
    i18n,
    areWeASubscriber: false,
    areWeAdmin: false,
    badges: [],
    blockConversation: action('blockConversation'),
    contact: defaultContact,
    conversation: defaultGroup,
    hasActiveCall: false,
    hasStories: undefined,
    hideContactModal: action('hideContactModal'),
    isAdmin: false,
    isMember: true,
    onOutgoingAudioCallInConversation: action(
      'onOutgoingAudioCallInConversation'
    ),
    onOutgoingVideoCallInConversation: action(
      'onOutgoingVideoCallInConversation'
    ),
    removeMemberFromGroup: action('removeMemberFromGroup'),
    showConversation: action('showConversation'),
    startAvatarDownload: action('startAvatarDownload'),
    theme: ThemeType.light,
    toggleAboutContactModal: action('AboutContactModal'),
    toggleAdmin: action('toggleAdmin'),
    toggleSafetyNumberModal: action('toggleSafetyNumberModal'),
    updateConversationModelSharedGroups: action(
      'updateConversationModelSharedGroups'
    ),
    viewUserStories: action('viewUserStories'),
  },
} satisfies Meta<PropsType>;

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<PropsType> = args => <ContactModal {...args} />;

export const AsNonAdmin = Template.bind({});
AsNonAdmin.args = {
  areWeAdmin: false,
};

export const AsAdmin = Template.bind({});
AsAdmin.args = {
  areWeAdmin: true,
};

export const AsAdminWithNoGroupLink = Template.bind({});
AsAdminWithNoGroupLink.args = {
  areWeAdmin: true,
  conversation: {
    ...defaultGroup,
    groupLink: undefined,
  },
};

export const AsAdminViewingNonMemberOfGroup = Template.bind({});
AsAdminViewingNonMemberOfGroup.args = {
  isMember: false,
};

export const WithoutPhoneNumber = Template.bind({});
WithoutPhoneNumber.args = {
  contact: {
    ...defaultContact,
    phoneNumber: undefined,
  },
};

export const ViewingSelf = Template.bind({});
ViewingSelf.args = {
  contact: {
    ...defaultContact,
    isMe: true,
  },
};

export const WithBadges = Template.bind({});
WithBadges.args = {
  badges: getFakeBadges(2),
};

export const WithUnreadStories = Template.bind({});
WithUnreadStories.args = {
  hasStories: HasStories.Unread,
};
WithUnreadStories.storyName = 'Unread Stories';

export const InSystemContacts = Template.bind({});
InSystemContacts.args = {
  contact: {
    ...defaultContact,
    systemGivenName: defaultContact.title,
  },
};

export const InAnotherCall = Template.bind({});
InAnotherCall.args = {
  hasActiveCall: true,
};

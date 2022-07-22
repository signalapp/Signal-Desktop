// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, Story } from '@storybook/react';
import * as React from 'react';
import casual from 'casual';

import type { ConversationType } from '../../state/ducks/conversations';
import type { PropsType } from './ContactModal';
import enMessages from '../../../_locales/en/messages.json';
import { ContactModal } from './ContactModal';
import { HasStories } from '../../types/Stories';
import { ThemeType } from '../../types/Util';
import { getDefaultConversation } from '../../test-both/helpers/getDefaultConversation';
import { getFakeBadges } from '../../test-both/helpers/getFakeBadge';
import { setupI18n } from '../../util/setupI18n';

const i18n = setupI18n('en', enMessages);

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
    i18n: {
      defaultValue: i18n,
    },
    areWeASubscriber: {
      defaultValue: false,
    },
    areWeAdmin: {
      defaultValue: false,
    },
    badges: {
      defaultValue: [],
    },
    contact: {
      defaultValue: defaultContact,
    },
    conversation: {
      defaultValue: defaultGroup,
    },
    hasStories: {
      defaultValue: undefined,
    },
    hideContactModal: { action: true },
    isAdmin: {
      defaultValue: false,
    },
    isMember: {
      defaultValue: true,
    },
    removeMemberFromGroup: { action: true },
    showConversation: { action: true },
    theme: {
      defaultValue: ThemeType.light,
    },
    toggleAdmin: { action: true },
    toggleSafetyNumberModal: { action: true },
    updateConversationModelSharedGroups: { action: true },
    viewUserStories: { action: true },
  },
} as Meta;

const Template: Story<PropsType> = args => <ContactModal {...args} />;

export const AsNonAdmin = Template.bind({});
AsNonAdmin.args = {
  areWeAdmin: false,
};
AsNonAdmin.story = {
  name: 'As non-admin',
};

export const AsAdmin = Template.bind({});
AsAdmin.args = {
  areWeAdmin: true,
};
AsAdmin.story = {
  name: 'As admin',
};

export const AsAdminWithNoGroupLink = Template.bind({});
AsAdminWithNoGroupLink.args = {
  areWeAdmin: true,
  conversation: {
    ...defaultGroup,
    groupLink: undefined,
  },
};
AsAdminWithNoGroupLink.story = {
  name: 'As admin with no group link',
};

export const AsAdminViewingNonMemberOfGroup = Template.bind({});
AsAdminViewingNonMemberOfGroup.args = {
  isMember: false,
};
AsAdminViewingNonMemberOfGroup.story = {
  name: 'As admin, viewing non-member of group',
};

export const WithoutPhoneNumber = Template.bind({});
WithoutPhoneNumber.args = {
  contact: {
    ...defaultContact,
    phoneNumber: undefined,
  },
};
WithoutPhoneNumber.story = {
  name: 'Without phone number',
};

export const ViewingSelf = Template.bind({});
ViewingSelf.args = {
  contact: {
    ...defaultContact,
    isMe: true,
  },
};
ViewingSelf.story = {
  name: 'Viewing self',
};

export const WithBadges = Template.bind({});
WithBadges.args = {
  badges: getFakeBadges(2),
};
WithBadges.story = {
  name: 'With badges',
};

export const WithUnreadStories = Template.bind({});
WithUnreadStories.args = {
  hasStories: HasStories.Unread,
};
WithUnreadStories.storyName = 'Unread Stories';

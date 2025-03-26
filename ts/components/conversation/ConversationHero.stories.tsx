// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, StoryFn } from '@storybook/react';
import React, { useContext } from 'react';
import casual from 'casual';
import { action } from '@storybook/addon-actions';
import type { Props } from './ConversationHero';
import { ConversationHero } from './ConversationHero';
import { HasStories } from '../../types/Stories';
import { StorybookThemeContext } from '../../../.storybook/StorybookThemeContext';
import { getDefaultConversation } from '../../test-both/helpers/getDefaultConversation';
import { ThemeType } from '../../types/Util';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Conversation/ConversationHero',
  component: ConversationHero,
  args: {
    conversationType: 'direct',
    fromOrAddedByTrustedContact: true,
    i18n,
    isDirectConvoAndHasNickname: false,
    theme: ThemeType.light,
    updateSharedGroups: action('updateSharedGroups'),
    viewUserStories: action('viewUserStories'),
    toggleAboutContactModal: action('toggleAboutContactModal'),
    toggleProfileNameWarningModal: action('toggleProfileNameWarningModal'),
    openConversationDetails: action('openConversationDetails'),
    startAvatarDownload: action('startAvatarDownload'),
    pendingAvatarDownload: false,
  },
} satisfies Meta<Props>;

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<Props> = args => {
  const theme = useContext(StorybookThemeContext);
  return (
    <div style={{ width: '480px' }}>
      <ConversationHero {...getDefaultConversation()} {...args} theme={theme} />
    </div>
  );
};

export const DirectFiveOtherGroups = Template.bind({});
DirectFiveOtherGroups.args = {
  sharedGroupNames: Array.from(Array(5), () => casual.title),
};

export const DirectFourOtherGroups = Template.bind({});
DirectFourOtherGroups.args = {
  sharedGroupNames: Array.from(Array(4), () => casual.title),
};

export const DirectThreeOtherGroups = Template.bind({});
DirectThreeOtherGroups.args = {
  sharedGroupNames: Array.from(Array(3), () => casual.title),
};

export const DirectTwoOtherGroups = Template.bind({});
DirectTwoOtherGroups.args = {
  sharedGroupNames: Array.from(Array(2), () => casual.title),
};

export const DirectOneOtherGroup = Template.bind({});
DirectOneOtherGroup.args = {
  sharedGroupNames: [casual.title],
};

export const DirectNoGroupsName = Template.bind({});
DirectNoGroupsName.args = {
  about: '👍 Free to chat',
};

export const DirectNoGroupsJustProfile = Template.bind({});
DirectNoGroupsJustProfile.args = {
  phoneNumber: casual.phone,
};

export const SignalConversation = Template.bind({});
SignalConversation.args = {
  isSignalConversation: true,
  phoneNumber: casual.phone,
};

export const DirectNoGroupsJustPhoneNumber = Template.bind({});
DirectNoGroupsJustPhoneNumber.args = {
  phoneNumber: casual.phone,
  profileName: '',
  title: casual.phone,
};

export const DirectNoGroupsNoData = Template.bind({});
DirectNoGroupsNoData.args = {
  avatarUrl: undefined,
  phoneNumber: '',
  profileName: '',
  title: casual.phone,
};

export const DirectNoGroupsNoDataNotAccepted = Template.bind({});
DirectNoGroupsNoDataNotAccepted.args = {
  acceptedMessageRequest: false,
  avatarUrl: undefined,
  phoneNumber: '',
  profileName: '',
  title: '',
};

export const DirectNoGroupsNotAcceptedWithAvatar = Template.bind({});
DirectNoGroupsNotAcceptedWithAvatar.args = {
  ...getDefaultConversation(),
  acceptedMessageRequest: false,
  profileName: '',
};

export const GroupManyMembers = Template.bind({});
GroupManyMembers.args = {
  conversationType: 'group',
  groupDescription: casual.sentence,
  membersCount: casual.integer(20, 100),
  title: casual.title,
};

export const GroupOneMember = Template.bind({});
GroupOneMember.args = {
  avatarUrl: undefined,
  conversationType: 'group',
  groupDescription: casual.sentence,
  membersCount: 1,
  title: casual.title,
};

export const GroupZeroMembers = Template.bind({});
GroupZeroMembers.args = {
  avatarUrl: undefined,
  conversationType: 'group',
  groupDescription: casual.sentence,
  membersCount: 0,
  title: casual.title,
};

export const GroupLongGroupDescription = Template.bind({});
GroupLongGroupDescription.args = {
  conversationType: 'group',
  groupDescription:
    "This is a group for all the rock climbers of NYC. We really like to climb rocks and these NYC people climb any rock. No rock is too small or too big to be climbed. We will ascend upon all rocks, and not just in NYC, in the whole world. We are just getting started, NYC is just the beginning, watch out rocks in the galaxy. Kuiper belt I'm looking at you. We will put on a space suit and climb all your rocks. No rock is near nor far for the rock climbers of NYC.",
  membersCount: casual.integer(1, 10),
  title: casual.title,
};

export const GroupNoName = Template.bind({});
GroupNoName.args = {
  conversationType: 'group',
  membersCount: 0,
  title: '',
};

export const GroupNotAccepted = Template.bind({});
GroupNotAccepted.args = {
  conversationType: 'group',
  groupDescription: casual.sentence,
  membersCount: casual.integer(20, 100),
  title: casual.title,
  acceptedMessageRequest: false,
};

export const NoteToSelf = Template.bind({});
NoteToSelf.args = {
  isMe: true,
};

export const UnreadStories = Template.bind({});
UnreadStories.args = {
  hasStories: HasStories.Unread,
};

export const ReadStories = Template.bind({});
ReadStories.args = {
  hasStories: HasStories.Read,
};

export const DirectNotFromTrustedContact = Template.bind({});
DirectNotFromTrustedContact.args = {
  conversationType: 'direct',
  title: casual.full_name,
  fromOrAddedByTrustedContact: false,
};

export const DirectWithNickname = Template.bind({});
DirectWithNickname.args = {
  conversationType: 'direct',
  title: casual.full_name,
  fromOrAddedByTrustedContact: false,
  isDirectConvoAndHasNickname: true,
};

export const GroupNotFromTrustedContact = Template.bind({});
GroupNotFromTrustedContact.args = {
  conversationType: 'group',
  title: casual.title,
  membersCount: casual.integer(5, 20),
  fromOrAddedByTrustedContact: false,
};

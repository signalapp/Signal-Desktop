// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, Story } from '@storybook/react';
import React, { useContext } from 'react';
import casual from 'casual';

import enMessages from '../../../_locales/en/messages.json';
import type { Props } from './ConversationHero';
import { ConversationHero } from './ConversationHero';
import { HasStories } from '../../types/Stories';
import { StorybookThemeContext } from '../../../.storybook/StorybookThemeContext';
import { getDefaultConversation } from '../../test-both/helpers/getDefaultConversation';
import { setupI18n } from '../../util/setupI18n';
import { ThemeType } from '../../types/Util';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/ConversationHero',
  component: ConversationHero,
  argTypes: {
    conversationType: {
      defaultValue: 'direct',
    },
    i18n: {
      defaultValue: i18n,
    },
    theme: {
      defaultValue: ThemeType.light,
    },
    unblurAvatar: { action: true },
    updateSharedGroups: { action: true },
    viewUserStories: { action: true },
  },
} as Meta;

const Template: Story<Props> = args => {
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
DirectFiveOtherGroups.story = {
  name: 'Direct (Five Other Groups)',
};

export const DirectFourOtherGroups = Template.bind({});
DirectFourOtherGroups.args = {
  sharedGroupNames: Array.from(Array(4), () => casual.title),
};
DirectFourOtherGroups.story = {
  name: 'Direct (Four Other Groups)',
};

export const DirectThreeOtherGroups = Template.bind({});
DirectThreeOtherGroups.args = {
  sharedGroupNames: Array.from(Array(3), () => casual.title),
};
DirectThreeOtherGroups.story = {
  name: 'Direct (Three Other Groups)',
};

export const DirectTwoOtherGroups = Template.bind({});
DirectTwoOtherGroups.args = {
  sharedGroupNames: Array.from(Array(2), () => casual.title),
};
DirectTwoOtherGroups.story = {
  name: 'Direct (Two Other Groups)',
};

export const DirectOneOtherGroup = Template.bind({});
DirectOneOtherGroup.args = {
  sharedGroupNames: [casual.title],
};
DirectOneOtherGroup.story = {
  name: 'Direct (One Other Group)',
};

export const DirectNoGroupsName = Template.bind({});
DirectNoGroupsName.args = {
  about: '👍 Free to chat',
};
DirectNoGroupsName.story = {
  name: 'Direct (No Groups, Name)',
};

export const DirectNoGroupsJustProfile = Template.bind({});
DirectNoGroupsJustProfile.args = {
  phoneNumber: casual.phone,
};
DirectNoGroupsJustProfile.story = {
  name: 'Direct (No Groups, Just Profile)',
};

export const DirectNoGroupsJustPhoneNumber = Template.bind({});
DirectNoGroupsJustPhoneNumber.args = {
  name: '',
  phoneNumber: casual.phone,
  profileName: '',
  title: '',
};
DirectNoGroupsJustPhoneNumber.story = {
  name: 'Direct (No Groups, Just Phone Number)',
};

export const DirectNoGroupsNoData = Template.bind({});
DirectNoGroupsNoData.args = {
  avatarPath: undefined,
  name: '',
  phoneNumber: '',
  profileName: '',
  title: '',
};
DirectNoGroupsNoData.story = {
  name: 'Direct (No Groups, No Data)',
};

export const DirectNoGroupsNoDataNotAccepted = Template.bind({});
DirectNoGroupsNoDataNotAccepted.args = {
  acceptedMessageRequest: false,
  avatarPath: undefined,
  name: '',
  phoneNumber: '',
  profileName: '',
  title: '',
};
DirectNoGroupsNoDataNotAccepted.story = {
  name: 'Direct (No Groups, No Data, Not Accepted)',
};

export const GroupManyMembers = Template.bind({});
GroupManyMembers.args = {
  conversationType: 'group',
  groupDescription: casual.sentence,
  membersCount: casual.integer(20, 100),
  title: casual.title,
};
GroupManyMembers.story = {
  name: 'Group (many members)',
};

export const GroupOneMember = Template.bind({});
GroupOneMember.args = {
  avatarPath: undefined,
  conversationType: 'group',
  groupDescription: casual.sentence,
  membersCount: 1,
  title: casual.title,
};
GroupOneMember.story = {
  name: 'Group (one member)',
};

export const GroupZeroMembers = Template.bind({});
GroupZeroMembers.args = {
  avatarPath: undefined,
  conversationType: 'group',
  groupDescription: casual.sentence,
  membersCount: 0,
  title: casual.title,
};
GroupZeroMembers.story = {
  name: 'Group (zero members)',
};

export const GroupLongGroupDescription = Template.bind({});
GroupLongGroupDescription.args = {
  conversationType: 'group',
  groupDescription:
    "This is a group for all the rock climbers of NYC. We really like to climb rocks and these NYC people climb any rock. No rock is too small or too big to be climbed. We will ascend upon all rocks, and not just in NYC, in the whole world. We are just getting started, NYC is just the beginning, watch out rocks in the galaxy. Kuiper belt I'm looking at you. We will put on a space suit and climb all your rocks. No rock is near nor far for the rock climbers of NYC.",
  membersCount: casual.integer(1, 10),
  title: casual.title,
};
GroupLongGroupDescription.story = {
  name: 'Group (long group description)',
};

export const GroupNoName = Template.bind({});
GroupNoName.args = {
  conversationType: 'group',
  membersCount: 0,
  name: '',
  title: '',
};
GroupNoName.story = {
  name: 'Group (No name)',
};

export const NoteToSelf = Template.bind({});
NoteToSelf.args = {
  isMe: true,
};
NoteToSelf.story = {
  name: 'Note to Self',
};

export const UnreadStories = Template.bind({});
UnreadStories.args = {
  hasStories: HasStories.Unread,
};

export const ReadStories = Template.bind({});
ReadStories.args = {
  hasStories: HasStories.Read,
};

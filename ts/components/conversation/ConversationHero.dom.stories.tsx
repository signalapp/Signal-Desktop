// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, StoryFn } from '@storybook/react';
import React, { useContext } from 'react';
import casual from 'casual';
import { action } from '@storybook/addon-actions';
import type { Props } from './ConversationHero.dom.js';
import { ConversationHero } from './ConversationHero.dom.js';
import { HasStories } from '../../types/Stories.std.js';
import { StorybookThemeContext } from '../../../.storybook/StorybookThemeContext.std.js';
import { getDefaultConversation } from '../../test-helpers/getDefaultConversation.std.js';
import { ThemeType } from '../../types/Util.std.js';
import type { GroupV2Membership } from './conversation-details/ConversationDetailsMembershipList.dom.js';

const { i18n } = window.SignalContext;

type CreateMembershipsArgs = {
  count: number;
  includeMe: boolean;
  unknownContactIndices?: ReadonlyArray<number>;
};

const createMemberships = ({
  count,
  includeMe,
  unknownContactIndices = [],
}: CreateMembershipsArgs): Array<GroupV2Membership> => {
  return Array.from(new Array(count)).map(
    (_, i): GroupV2Membership => ({
      isAdmin: i % 3 === 0,
      member: unknownContactIndices.includes(i)
        ? getDefaultConversation({
            isMe: includeMe && i === 0,
            titleShortNoDefault: undefined,
          })
        : getDefaultConversation({
            isMe: includeMe && i === 0, // First member is "me" if includeMe is true
          }),
    })
  );
};

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
  const baseProps = {
    ...args,
    ...getDefaultConversation(),
  };

  const memberships = createMemberships({
    count: baseProps.membersCount ?? 0,
    includeMe: baseProps.acceptedMessageRequest ?? false,
  });
  return (
    <div style={{ width: '480px' }}>
      <ConversationHero
        {...baseProps}
        memberships={memberships}
        theme={theme}
      />
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
  avatarUrl: 'images/profile-avatar.svg',
  title: 'Signal',
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
  acceptedMessageRequest: false,
  profileName: '',
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

export function GroupMemberNames(args: Props): JSX.Element {
  const theme = useContext(StorybookThemeContext);
  const baseProps = {
    ...args,
    theme,
    conversationType: 'group' as const,
    title: 'Group Chat',
    isMe: false,
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '40px',
        width: '480px',
      }}
    >
      <div>
        <h2>When user is NOT in the group</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          <div>
            <h3>0 members</h3>
            <ConversationHero
              {...baseProps}
              membersCount={0}
              memberships={createMemberships({ count: 0, includeMe: false })}
            />
          </div>
          <div>
            <h3>1 member</h3>
            <ConversationHero
              {...baseProps}
              membersCount={1}
              memberships={createMemberships({ count: 1, includeMe: false })}
            />
          </div>
          <div>
            <h3>2 members</h3>
            <ConversationHero
              {...baseProps}
              membersCount={2}
              memberships={createMemberships({ count: 2, includeMe: false })}
            />
          </div>
          <div>
            <h3>2 members + 2 invited</h3>
            <ConversationHero
              {...baseProps}
              membersCount={2}
              memberships={createMemberships({ count: 2, includeMe: false })}
              invitesCount={2}
            />
          </div>
          <div>
            <h3>3 members</h3>
            <ConversationHero
              {...baseProps}
              membersCount={3}
              memberships={createMemberships({ count: 3, includeMe: false })}
            />
          </div>
          <div>
            <h3>5 members</h3>
            <ConversationHero
              {...baseProps}
              membersCount={5}
              memberships={createMemberships({ count: 5, includeMe: false })}
            />
          </div>
          <div>
            <h3>5 members + 2 invited</h3>
            <ConversationHero
              {...baseProps}
              membersCount={5}
              memberships={createMemberships({ count: 5, includeMe: false })}
              invitesCount={2}
            />
          </div>
        </div>
      </div>

      <div>
        <h2>When user is in the group</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          <div>
            <h3>Just me (1 member)</h3>
            <ConversationHero
              {...baseProps}
              membersCount={1}
              memberships={createMemberships({ count: 1, includeMe: true })}
            />
          </div>
          <div>
            <h3>Just me (1 member) + 1 invited</h3>
            <ConversationHero
              {...baseProps}
              membersCount={1}
              memberships={createMemberships({ count: 1, includeMe: true })}
              invitesCount={1}
            />
          </div>
          <div>
            <h3>Me + 1 other (2 members)</h3>
            <ConversationHero
              {...baseProps}
              membersCount={2}
              memberships={createMemberships({ count: 2, includeMe: true })}
            />
          </div>
          <div>
            <h3>Me + 2 others (3 members)</h3>
            <ConversationHero
              {...baseProps}
              membersCount={3}
              memberships={createMemberships({ count: 3, includeMe: true })}
            />
          </div>
          <div>
            <h3>Me + 3 others (4 members)</h3>
            <ConversationHero
              {...baseProps}
              membersCount={4}
              memberships={createMemberships({ count: 4, includeMe: true })}
            />
          </div>
          <div>
            <h3>Me + 4 others (5 members)</h3>
            <ConversationHero
              {...baseProps}
              membersCount={5}
              memberships={createMemberships({ count: 5, includeMe: true })}
            />
          </div>
        </div>
      </div>

      <div>
        <h2>Edge Cases</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          <div>
            <h3>Unknown Contact in Small Group</h3>
            <ConversationHero
              {...baseProps}
              membersCount={2}
              memberships={createMemberships({
                count: 2,
                includeMe: true,
                unknownContactIndices: [1],
              })}
            />
          </div>
          <div>
            <h3>Unknown Hidden Under &quot;others&quot;</h3>
            <ConversationHero
              {...baseProps}
              membersCount={2}
              memberships={createMemberships({
                count: 10,
                includeMe: false,
                unknownContactIndices: [2, 3, 4],
              })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

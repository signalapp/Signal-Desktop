// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, StoryFn } from '@storybook/react';
import React, { useContext } from 'react';
import casual from 'casual';
import { action } from '@storybook/addon-actions';
import type { Props } from './ConversationHero.dom.tsx';
import { ConversationHero } from './ConversationHero.dom.tsx';
import { HasStories } from '../../types/Stories.std.ts';
import { StorybookThemeContext } from '../../../.storybook/StorybookThemeContext.std.ts';
import { getDefaultConversation } from '../../test-helpers/getDefaultConversation.std.ts';
import { ThemeType } from '../../types/Util.std.ts';
import type { GroupV2Membership } from './conversation-details/ConversationDetailsMembershipList.dom.tsx';

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
      labelEmoji: i % 6 === 0 ? '🟢' : undefined,
      labelString: i % 3 === 0 ? `Task Wrangler ${i}` : undefined,
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
    fromOrAddedByTrustedContact: false,
    i18n,
    hasNickname: false,
    hasProfileName: true,
    isInSystemContacts: false,
    theme: ThemeType.light,
    sharedGroupNames: [],
    viewUserStories: action('viewUserStories'),
    toggleAboutContactModal: action('toggleAboutContactModal'),
    toggleProfileNameWarningModal: action('toggleProfileNameWarningModal'),
    openConversationDetails: action('openConversationDetails'),
    startAvatarDownload: action('startAvatarDownload'),
    pendingAvatarDownload: false,
  },
} satisfies Meta<Props>;

const Template: StoryFn<Props> = args => {
  const theme = useContext(StorybookThemeContext);
  const baseProps = {
    ...getDefaultConversation(),
    ...args,
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

export const DirectNoGroups = Template.bind({});
DirectNoGroups.args = {};

export const DirectWithNickname = Template.bind({});
DirectWithNickname.args = { hasNickname: true };

export const DirectInSystemContacts = Template.bind({});
DirectInSystemContacts.args = { hasNickname: true, isInSystemContacts: true };

export const DirectNoProfileName = Template.bind({});
DirectNoProfileName.args = { title: '123-555-1234', hasProfileName: false };

export const DirectMessageRequest = Template.bind({});
DirectMessageRequest.args = { acceptedMessageRequest: false };

export const DirectUnreadStories = Template.bind({});
DirectUnreadStories.args = {
  hasStories: HasStories.Unread,
};

export const DirectReadStories = Template.bind({});
DirectReadStories.args = {
  hasStories: HasStories.Read,
};
export const SignalConversation = Template.bind({});
SignalConversation.args = {
  avatarUrl: 'images/profile-avatar.svg',
  title: 'Signal',
  isSignalConversation: true,
};

export const NoteToSelf = Template.bind({});
NoteToSelf.args = {
  isMe: true,
};

const groupArgs = {
  conversationType: 'group',
  membersCount: casual.integer(1, 10),
  title: 'Group title',
} as const;

export const Group = Template.bind({});
Group.args = {
  ...groupArgs,
  title: 'This is the title that never ends',
};
export const GroupLongTitle = Template.bind({});
GroupLongTitle.args = {
  ...groupArgs,
  title: 'This is the title that never ends',
};

export const GroupLongGroupDescription = Template.bind({});
GroupLongGroupDescription.args = {
  ...groupArgs,
  groupDescription:
    "This is anextremelylargewordinaverylargegroupdescriptionandagroup for all the rock climbers of NYC. We really like to climb rocks and these NYC people climb any rock. No rock is too small or too big to be climbed. We will ascend upon all rocks, and not just in NYC, in the whole world. We are just getting started, NYC is just the beginning, watch out rocks in the galaxy. Kuiper belt I'm looking at you. We will put on a space suit and climb all your rocks. No rock is near nor far for the rock climbers of NYC.",
};

export const GroupMessageRequest = Template.bind({});
GroupMessageRequest.args = {
  ...groupArgs,
  groupDescription: casual.sentence,
  acceptedMessageRequest: false,
};

export const GroupFromTrustedContact = Template.bind({});
GroupFromTrustedContact.args = {
  ...groupArgs,
  fromOrAddedByTrustedContact: true,
};

export function GroupMemberNames(args: Props): React.JSX.Element {
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

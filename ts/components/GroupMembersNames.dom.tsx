// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useMemo } from 'react';
import type { ReactNode } from 'react';
import lodash from 'lodash';

import { I18n } from './I18n.dom.tsx';
import type { LocalizerType } from '../types/Util.std.ts';
import { UserText } from './UserText.dom.tsx';
import type { GroupV2Membership } from './conversation/conversation-details/ConversationDetailsMembershipList.dom.tsx';

const { take } = lodash;

type PropsType = {
  i18n: LocalizerType;
  nameClassName?: string;
  memberships: ReadonlyArray<GroupV2Membership>;
  invitesCount?: number;
  onOtherMembersClick?: () => void;
};

// Define renderClickableButton outside component to avoid nested component definitions
function renderClickableButton(
  parts: ReactNode,
  onOtherMembersClick?: () => void
): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={ev => {
        ev.preventDefault();
        if (onOtherMembersClick) {
          onOtherMembersClick();
        }
      }}
    >
      {parts}
    </button>
  );
}

function MemberList({
  otherMemberNames,
  firstThreeMemberNames,
  areWeInGroup,
  i18n,
  onOtherMembersClick,
}: {
  otherMemberNames: ReadonlyArray<string | undefined>;
  firstThreeMemberNames: Array<React.JSX.Element>;
  areWeInGroup: boolean;
  i18n: LocalizerType;
  onOtherMembersClick?: () => void;
}): React.JSX.Element {
  const [member1, member2, member3] = firstThreeMemberNames;

  if (areWeInGroup) {
    if (member1 == null) {
      return (
        <I18n i18n={i18n} id="icu:ConversationHero--group-members-only-you" />
      );
    }

    if (member2 == null) {
      return (
        <I18n
          i18n={i18n}
          id="icu:ConversationHero--group-members-one-and-you"
          components={{
            member: member1,
          }}
        />
      );
    }

    if (member3 == null) {
      return (
        <I18n
          i18n={i18n}
          id="icu:ConversationHero--group-members-two-and-you"
          components={{
            member1,
            member2,
          }}
        />
      );
    }

    // For 3+ members, "you" is looped in with "others", not shown separately
    const remainingCount = otherMemberNames.length + Number(areWeInGroup) - 3;
    return (
      <I18n
        i18n={i18n}
        id="icu:ConversationHero--group-members-other-and-you"
        components={{
          member1,
          member2,
          member3,
          clickable: (parts: ReactNode) =>
            renderClickableButton(parts, onOtherMembersClick),
          remainingCount,
        }}
      />
    );
  }

  // When the user is not in the group

  if (member1 == null) {
    return <I18n i18n={i18n} id="icu:ConversationHero--group-members-zero" />;
  }

  if (member2 == null) {
    return (
      <I18n
        i18n={i18n}
        id="icu:ConversationHero--group-members-one"
        components={{
          member: member1,
        }}
      />
    );
  }

  if (member3 == null) {
    return (
      <I18n
        i18n={i18n}
        id="icu:ConversationHero--group-members-two"
        components={{
          member1,
          member2,
        }}
      />
    );
  }

  if (otherMemberNames.length === 3) {
    return (
      <I18n
        i18n={i18n}
        id="icu:ConversationHero--group-members-three"
        components={{
          member1,
          member2,
          member3,
        }}
      />
    );
  }

  // More than 3 members
  const remainingCount = otherMemberNames.length - 3;
  return (
    <I18n
      i18n={i18n}
      id="icu:ConversationHero--group-members-other"
      components={{
        member1,
        member2,
        member3,
        clickable: (parts: ReactNode) =>
          renderClickableButton(parts, onOtherMembersClick),
        remainingCount,
      }}
    />
  );
}

export function GroupMembersNames({
  i18n,
  nameClassName,
  memberships,
  invitesCount,
  onOtherMembersClick,
}: PropsType): React.JSX.Element {
  const areWeInGroup = useMemo(() => {
    return memberships.some(({ member }) => member.isMe);
  }, [memberships]);

  const otherMemberNames = useMemo(() => {
    return memberships
      .filter(({ member }) => !member.isMe)
      .map(({ member }) => member.titleShortNoDefault);
  }, [memberships]);

  // Take the first 3 members for display, prioritizing defined names
  // "Unknown" is the fallback name if we never got the right profileKey
  // for a user, or haven't fetched their profile yet.
  const firstThreeMembers = useMemo(() => {
    return take(
      [...otherMemberNames].sort((a, b) => {
        if (a === undefined) {
          return 1;
        }
        if (b === undefined) {
          return -1;
        }
        return 0;
      }),
      3
    ).map((name, i) => (
      // We cannot guarantee uniqueness of member names
      // oxlint-disable-next-line react/no-array-index-key
      <span key={i} className={nameClassName}>
        <UserText text={name ?? i18n('icu:unknownContactShort')} />
      </span>
    ));
  }, [otherMemberNames, nameClassName, i18n]);

  const memberListElement = (
    <MemberList
      otherMemberNames={otherMemberNames}
      firstThreeMemberNames={firstThreeMembers}
      areWeInGroup={areWeInGroup}
      i18n={i18n}
      onOtherMembersClick={onOtherMembersClick}
    />
  );

  // If there are invited members, wrap in the "(+1 invited)" format
  if (invitesCount && invitesCount > 0) {
    return (
      <I18n
        i18n={i18n}
        id="icu:ConversationHero--member-list-and-invited"
        components={{
          memberList: memberListElement,
          invitesCount,
        }}
      />
    );
  }

  // Otherwise just return the member list
  return memberListElement;
}

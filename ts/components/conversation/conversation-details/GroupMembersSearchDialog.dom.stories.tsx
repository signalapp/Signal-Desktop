// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta } from '@storybook/react';
import type { ReactNode } from 'react';
import {
  GroupMembersSearchDialog,
  GroupMembersSearchDialogFilter,
} from './GroupMembersSearchDialog.dom.tsx';
import type { GroupV2Membership } from './ConversationDetailsMembershipList.dom.tsx';
import { getDefaultConversation } from '../../../test-helpers/getDefaultConversation.std.ts';
import { Emoji } from '../../../axo/emoji.std.ts';
import { action } from '@storybook/addon-actions';

const { i18n } = window.SignalContext;

function mockMembers(
  count: number,
  options?: { noAdmins?: boolean; noSystemContacts?: boolean }
): ReadonlyArray<GroupV2Membership> {
  return Array.from({ length: count }, (_, i): GroupV2Membership => {
    const member = {
      ...getDefaultConversation({
        isMe: i === 2,
      }),
    };

    if (!options?.noSystemContacts && i % 4 === 0) {
      member.systemGivenName = member.firstName;
      member.systemFamilyName = member.familyName;
    }

    let isAdmin = false;
    if (!options?.noAdmins && i % 5 === 0) {
      isAdmin = true;
    }

    return {
      isAdmin,
      labelEmoji: i % 6 === 0 ? Emoji.GREEN_CIRCLE : undefined,
      labelString: i % 3 === 0 ? `Task Wrangler ${i}` : undefined,
      member,
    };
  });
}

export default {
  title: 'Components/Conversation/ConversationDetails/GroupMembersSearchDialog',
} satisfies Meta;

export function Default(): ReactNode {
  return (
    <GroupMembersSearchDialog
      i18n={i18n}
      open
      onOpenChange={action('onOpenChange')}
      canAddNewMembers
      canInviteViaGroupLink
      groupLink="group-link"
      members={mockMembers(50)}
      onSelectMember={action('onSelectMember')}
      onSelectAddMember={action('onSelectAddMember')}
    />
  );
}

export function CannotAddNewMembers(): ReactNode {
  return (
    <GroupMembersSearchDialog
      i18n={i18n}
      open
      onOpenChange={action('onOpenChange')}
      canAddNewMembers={false}
      canInviteViaGroupLink
      groupLink="group-link"
      members={mockMembers(2)}
      onSelectMember={action('onSelectMember')}
      onSelectAddMember={action('onSelectAddMember')}
    />
  );
}

export function CanInviteViaGroupLink(): ReactNode {
  return (
    <GroupMembersSearchDialog
      i18n={i18n}
      open
      onOpenChange={action('onOpenChange')}
      canAddNewMembers
      canInviteViaGroupLink={false}
      groupLink="group-link"
      members={mockMembers(2)}
      onSelectMember={action('onSelectMember')}
      onSelectAddMember={action('onSelectAddMember')}
    />
  );
}

export function NoAvailableActions(): ReactNode {
  return (
    <GroupMembersSearchDialog
      i18n={i18n}
      open
      onOpenChange={action('onOpenChange')}
      canAddNewMembers={false}
      canInviteViaGroupLink={false}
      groupLink="group-link"
      members={mockMembers(2)}
      onSelectMember={action('onSelectMember')}
      onSelectAddMember={action('onSelectAddMember')}
    />
  );
}

export function NoAdmins(): ReactNode {
  return (
    <GroupMembersSearchDialog
      i18n={i18n}
      open
      onOpenChange={action('onOpenChange')}
      canAddNewMembers={false}
      canInviteViaGroupLink={false}
      groupLink="group-link"
      members={mockMembers(10, { noAdmins: true })}
      onSelectMember={action('onSelectMember')}
      onSelectAddMember={action('onSelectAddMember')}
      _initialFilter={GroupMembersSearchDialogFilter.Admins}
    />
  );
}

export function NoSystemContacts(): ReactNode {
  return (
    <GroupMembersSearchDialog
      i18n={i18n}
      open
      onOpenChange={action('onOpenChange')}
      canAddNewMembers={false}
      canInviteViaGroupLink={false}
      groupLink="group-link"
      members={mockMembers(10, { noSystemContacts: true })}
      onSelectMember={action('onSelectMember')}
      onSelectAddMember={action('onSelectAddMember')}
      _initialFilter={GroupMembersSearchDialogFilter.SystemContacts}
    />
  );
}

export function NoSearchResults(): ReactNode {
  return (
    <GroupMembersSearchDialog
      i18n={i18n}
      open
      onOpenChange={action('onOpenChange')}
      canAddNewMembers={false}
      canInviteViaGroupLink={false}
      groupLink="group-link"
      members={mockMembers(10)}
      onSelectMember={action('onSelectMember')}
      onSelectAddMember={action('onSelectAddMember')}
      _initialSearchValue="thisshouldnotmatchanythingreallyreallylongtextthatshouldoverflow"
    />
  );
}

export function SearchingAndFiltering(): ReactNode {
  return (
    <GroupMembersSearchDialog
      i18n={i18n}
      open
      onOpenChange={action('onOpenChange')}
      canAddNewMembers={false}
      canInviteViaGroupLink={false}
      groupLink="group-link"
      members={mockMembers(50)}
      onSelectMember={action('onSelectMember')}
      onSelectAddMember={action('onSelectAddMember')}
      _initialSearchValue="a"
      _initialFilter={GroupMembersSearchDialogFilter.SystemContacts}
    />
  );
}

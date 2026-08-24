// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { AxoDialog } from '../../../axo/AxoDialog.dom.tsx';
import { filterAndSortConversations } from '../../../util/filterAndSortConversations.std.ts';
import type { GroupV2Membership } from './ConversationDetailsMembershipList.dom.tsx';
import { AxoSearchField } from '../../../axo/fields/AxoSearchField.dom.tsx';
import type { ConversationType } from '../../../state/ducks/conversations.preload.ts';
import { strictAssert } from '../../../util/assert.std.ts';
import { tw } from '../../../axo/tw.dom.tsx';
import { Avatar, AvatarBlur, AvatarSize } from '../../Avatar.dom.tsx';
import type { LocalizerType } from '../../../types/I18N.std.ts';
import { isInSystemContacts } from '../../../util/isInSystemContacts.std.ts';
import { AxoContactList } from '../../../axo/items/AxoContactList.dom.tsx';
import { AriaClickable } from '../../../axo/AriaClickable.dom.tsx';
import { UserText } from '../../UserText.dom.tsx';
import { AxoContactName } from '../../../axo/AxoContactName.dom.tsx';
import { AxoIconButton } from '../../../axo/AxoIconButton.dom.tsx';
import { AxoDropdownMenu } from '../../../axo/AxoDropdownMenu.dom.tsx';
import { missingCaseError } from '../../../util/missingCaseError.std.ts';
import { copyGroupLink } from '../../../util/copyLinksWithToast.dom.ts';
import { drop } from '../../../util/drop.std.ts';
import { I18n } from '../../I18n.dom.tsx';

const IS_LETTER_REGEX = /^\p{Letter}\p{Mark}*/u;

export enum GroupMembersSearchDialogFilter {
  All = '',
  Admins = 'admins',
  SystemContacts = 'system-contacts',
}

export type GroupMembersSearchDialogProps = Readonly<{
  i18n: LocalizerType;

  open: boolean;
  onOpenChange: (open: boolean) => void;

  canAddNewMembers: boolean;
  canInviteViaGroupLink: boolean;
  groupLink: string | null;
  members: ReadonlyArray<GroupV2Membership>;
  onSelectMember: (member: GroupV2Membership) => void;
  onSelectAddMember: () => void;

  // testing
  _initialFilter?: GroupMembersSearchDialogFilter;
  _initialSearchValue?: string;
}>;

export function GroupMembersSearchDialog(
  props: GroupMembersSearchDialogProps
): ReactNode {
  const {
    i18n,
    canInviteViaGroupLink,
    groupLink,
    members,
    onOpenChange,
    onSelectMember,
    onSelectAddMember,
  } = props;
  const [searchValue, setSearchValue] = useState(
    props._initialSearchValue ?? ''
  );
  const [filter, setFilter] = useState(
    props._initialFilter ?? GroupMembersSearchDialogFilter.All
  );

  const searchQuery = useMemo(() => {
    return searchValue.trim();
  }, [searchValue]);

  const filteredMembers = useMemo(() => {
    if (filter === GroupMembersSearchDialogFilter.All) {
      return members;
    }
    if (filter === GroupMembersSearchDialogFilter.Admins) {
      return members.filter(member => member.isAdmin);
    }
    if (filter === GroupMembersSearchDialogFilter.SystemContacts) {
      return members.filter(member => isInSystemContacts(member.member));
    }
    throw missingCaseError(filter);
  }, [members, filter]);

  const handleSelectMember = useCallback(
    (member: GroupV2Membership) => {
      onOpenChange(false);
      onSelectMember(member);
    },
    [onOpenChange, onSelectMember]
  );

  const handleSelectAddMember = useCallback(() => {
    onOpenChange(false);
    onSelectAddMember();
  }, [onOpenChange, onSelectAddMember]);

  const handleSelectInviteViaGroupLink = useCallback(() => {
    strictAssert(canInviteViaGroupLink, 'cannot invite via group link');
    strictAssert(groupLink, 'missing group link');
    drop(copyGroupLink(groupLink));
  }, [canInviteViaGroupLink, groupLink]);

  return (
    <AxoDialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <AxoDialog.Content size="md" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title>
            {i18n('icu:GroupMembersSearchDialog__DialogTitle')}
          </AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Search>
          <SearchField
            i18n={i18n}
            searchValue={searchValue}
            onSearchValueChange={setSearchValue}
            filter={filter}
          />
          <FilterMenu i18n={i18n} filter={filter} onFilterChange={setFilter} />
        </AxoDialog.Search>
        <AxoDialog.Body
          scrollbarWidth="none"
          padding="md"
          noFooterHideBottomScrollHint
          forceMaxHeight
        >
          <div className={tw('flex flex-col gap-2 pb-4')}>
            {searchQuery === '' ? (
              <AlphabeticMemberList
                i18n={i18n}
                members={filteredMembers}
                onSelectMember={handleSelectMember}
              />
            ) : (
              <SearchResults
                i18n={i18n}
                members={filteredMembers}
                searchQuery={searchQuery}
                onSelectMember={handleSelectMember}
              />
            )}

            {(props.canAddNewMembers || props.canInviteViaGroupLink) && (
              <AxoContactList.Root>
                {props.canAddNewMembers && (
                  <AxoContactList.ActionItem
                    symbol="plus"
                    title={i18n(
                      'icu:GroupMembersSearchDialog__BottomActions__AddMembers'
                    )}
                    onClick={handleSelectAddMember}
                  />
                )}
                {props.canInviteViaGroupLink && (
                  <AxoContactList.ActionItem
                    symbol="link"
                    title={i18n(
                      'icu:GroupMembersSearchDialog__BottomActions__InviteViaGroupLink'
                    )}
                    onClick={handleSelectInviteViaGroupLink}
                  />
                )}
              </AxoContactList.Root>
            )}
          </div>
        </AxoDialog.Body>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

type SearchFieldProps = Readonly<{
  i18n: LocalizerType;
  searchValue: string;
  onSearchValueChange: (searchValue: string) => void;
  filter: GroupMembersSearchDialogFilter;
}>;

function SearchField(props: SearchFieldProps): ReactNode {
  const { i18n, filter } = props;

  const placeholder = useMemo(() => {
    if (filter === GroupMembersSearchDialogFilter.All) {
      return i18n('icu:GroupMembersSearchDialog__SearchField__Placeholder');
    }

    if (filter === GroupMembersSearchDialogFilter.Admins) {
      return i18n(
        'icu:GroupMembersSearchDialog__SearchField__Placeholder--FilteringByAdmins'
      );
    }

    if (filter === GroupMembersSearchDialogFilter.SystemContacts) {
      return i18n(
        'icu:GroupMembersSearchDialog__SearchField__Placeholder--FilteringBySystemContacts'
      );
    }

    throw missingCaseError(filter);
  }, [i18n, filter]);

  return (
    <AxoSearchField.Root
      value={props.searchValue}
      onValueChange={props.onSearchValueChange}
      placeholder={placeholder}
      autoFocus
    />
  );
}

type FilterMenuProps = Readonly<{
  i18n: LocalizerType;
  filter: GroupMembersSearchDialogFilter;
  onFilterChange: (filter: GroupMembersSearchDialogFilter) => void;
}>;

function FilterMenu(props: FilterMenuProps): ReactNode {
  const { i18n, onFilterChange } = props;

  const handleFilterChange = useCallback(
    (value: string) => {
      onFilterChange(value as GroupMembersSearchDialogFilter);
    },
    [onFilterChange]
  );

  return (
    <AxoDropdownMenu.Root>
      <AxoDropdownMenu.Trigger>
        <AxoIconButton.Root
          symbol="filter"
          size="md"
          variant="implied-secondary"
          label={i18n('icu:GroupMembersSearchDialog__FilterMenu__Label')}
          pressed={props.filter !== GroupMembersSearchDialogFilter.All}
          tooltip={{
            label: i18n('icu:GroupMembersSearchDialog__FilterMenu__Label'),
            onlyShowOnFocusForUserInputDeviceEvents: true,
          }}
        />
      </AxoDropdownMenu.Trigger>
      <AxoDropdownMenu.Content>
        <AxoDropdownMenu.Label>
          {i18n('icu:GroupMembersSearchDialog__FilterMenu__Label')}
        </AxoDropdownMenu.Label>
        <AxoDropdownMenu.RadioGroup
          value={props.filter}
          onValueChange={handleFilterChange}
        >
          <AxoDropdownMenu.RadioItem
            symbol="group"
            value={GroupMembersSearchDialogFilter.All}
          >
            {i18n('icu:GroupMembersSearchDialog__FilterMenu__AllMembers')}
          </AxoDropdownMenu.RadioItem>
          <AxoDropdownMenu.Separator />
          <AxoDropdownMenu.RadioItem
            symbol="key"
            value={GroupMembersSearchDialogFilter.Admins}
          >
            {i18n('icu:GroupMembersSearchDialog__FilterMenu__Admins')}
          </AxoDropdownMenu.RadioItem>
          <AxoDropdownMenu.RadioItem
            symbol="person-circle"
            value={GroupMembersSearchDialogFilter.SystemContacts}
          >
            {i18n('icu:GroupMembersSearchDialog__FilterMenu__SystemContacts')}
          </AxoDropdownMenu.RadioItem>
        </AxoDropdownMenu.RadioGroup>
      </AxoDropdownMenu.Content>
    </AxoDropdownMenu.Root>
  );
}

type AlphabeticMemberListProps = Readonly<{
  i18n: LocalizerType;
  members: ReadonlyArray<GroupV2Membership>;
  onSelectMember: (member: GroupV2Membership) => void;
}>;

function AlphabeticMemberList(props: AlphabeticMemberListProps): ReactNode {
  const { i18n, members } = props;

  const sections = useMemo(() => {
    const segmenter = new Intl.Segmenter([], { granularity: 'grapheme' });

    function getFirstInitial(conversation: ConversationType): string {
      const title = conversation.titleNoDefault ?? '';
      const segments = segmenter.segment(title);

      for (const segment of segments) {
        if (IS_LETTER_REGEX.test(segment.segment)) {
          return segment.segment.toUpperCase();
        }
      }

      return '';
    }

    const groups = new Map<string, Array<GroupV2Membership>>();

    for (const member of members) {
      const initial = getFirstInitial(member.member);
      const group = groups.getOrInsert(initial, []);
      group.push(member);
    }

    const initials = Array.from(groups.keys()).toSorted((a, b) => {
      if (a === '') return 1;
      if (b === '') return -1;
      return a.localeCompare(b);
    });

    return initials.map(initial => {
      return {
        initial,
        members: groups.get(initial) ?? [],
      };
    });
  }, [members]);

  return (
    <>
      {sections.map(section => {
        return (
          <AxoContactList.Root key={section.initial} title={section.initial}>
            {section.members.map(member => {
              return (
                <MemberItem
                  key={member.member.id}
                  i18n={i18n}
                  member={member}
                  onSelectMember={props.onSelectMember}
                />
              );
            })}
          </AxoContactList.Root>
        );
      })}
      {sections.length === 0 && (
        <AxoContactList.Root>
          <AxoContactList.EmptyStateItem
            title={i18n(
              'icu:GroupMembersSearchDialog__EmptyState__NoResults--WithoutSearchQuery'
            )}
          />
        </AxoContactList.Root>
      )}
    </>
  );
}

type SearchResultsProps = Readonly<{
  i18n: LocalizerType;
  members: ReadonlyArray<GroupV2Membership>;
  searchQuery: string;
  onSelectMember: (member: GroupV2Membership) => void;
}>;

function SearchResults(props: SearchResultsProps): ReactNode {
  const { i18n, members, searchQuery } = props;

  const results = useMemo((): ReadonlyArray<GroupV2Membership> => {
    const memberByConversationId = new Map<string, GroupV2Membership>();
    const conversations: Array<ConversationType> = [];

    for (const member of members) {
      memberByConversationId.set(member.member.id, member);
      conversations.push(member.member);
    }

    const filtered = filterAndSortConversations(
      conversations,
      searchQuery,
      undefined
    );

    const result = filtered.map(conversation => {
      const member = memberByConversationId.get(conversation.id);
      strictAssert(member, 'missing member');
      return member;
    });

    return result;
  }, [searchQuery, members]);

  return (
    <AxoContactList.Root
      title={i18n('icu:GroupMembersSearchDialog__SearchResults__Title')}
    >
      {results.map(result => {
        return (
          <MemberItem
            key={result.member.id}
            i18n={i18n}
            member={result}
            onSelectMember={props.onSelectMember}
          />
        );
      })}

      {results.length === 0 && (
        <AxoContactList.EmptyStateItem
          title={
            <I18n
              i18n={i18n}
              id="icu:GroupMembersSearchDialog__EmptyState__NoResults--WithSearchQuery"
              components={{
                searchQuery: <UserText text={searchQuery} />,
              }}
            />
          }
        />
      )}
    </AxoContactList.Root>
  );
}

type MemberItemProps = Readonly<{
  i18n: LocalizerType;
  member: GroupV2Membership;
  onSelectMember: (member: GroupV2Membership) => void;
}>;

function MemberItem(props: MemberItemProps): ReactNode {
  const { i18n, member, onSelectMember } = props;
  const conversation = member.member;

  const inSystemContacts = isInSystemContacts(conversation);

  const handleClick = useCallback(() => {
    onSelectMember(member);
  }, [onSelectMember, member]);

  return (
    <AxoContactList.Item
      avatar={
        <Avatar
          i18n={i18n}
          conversationType={conversation.type}
          avatarUrl={conversation.avatarUrl}
          avatarPlaceholderGradient={conversation.avatarPlaceholderGradient}
          blur={AvatarBlur.NoBlur}
          color={conversation.color}
          hasAvatar={conversation.hasAvatar}
          noteToSelf={false}
          phoneNumber={conversation.phoneNumber}
          profileName={conversation.profileName}
          size={AvatarSize.THIRTY_TWO}
          title={conversation.title}
          badge={undefined}
        />
      }
      title={
        <>
          <UserText
            text={conversation.isMe ? i18n('icu:you') : conversation.title}
          />
          {inSystemContacts && (
            <>
              &nbsp;
              <AriaClickable.DeadArea className={tw('inline-block')}>
                <AxoContactName.SystemContactEmblem />
              </AriaClickable.DeadArea>
            </>
          )}
        </>
      }
      value={
        member.isAdmin
          ? i18n('icu:GroupMembersSearchDialog__MemberItem__Admin')
          : null
      }
      onClick={handleClick}
    />
  );
}

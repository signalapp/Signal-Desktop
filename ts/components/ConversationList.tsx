// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { useCallback } from 'react';
import type { ListRowRenderer } from 'react-virtualized';
import classNames from 'classnames';
import { get, pick } from 'lodash';

import { missingCaseError } from '../util/missingCaseError';
import { assertDev } from '../util/assert';
import type { ParsedE164Type } from '../util/libphonenumberInstance';
import type { LocalizerType, ThemeType } from '../types/Util';
import { ScrollBehavior } from '../types/Util';
import { getNavSidebarWidthBreakpoint } from './_util';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import type { LookupConversationWithoutServiceIdActionsType } from '../util/lookupConversationWithoutServiceId';
import type { ShowConversationType } from '../state/ducks/conversations';

import type { PropsData as ConversationListItemPropsType } from './conversationList/ConversationListItem';
import type { ContactCheckboxDisabledReason } from './conversationList/ContactCheckbox';
import type { ContactListItemConversationType as ContactListItemPropsType } from './conversationList/ContactListItem';
import type { GroupListItemConversationType } from './conversationList/GroupListItem';
import { ConversationListItem } from './conversationList/ConversationListItem';
import { ContactListItem } from './conversationList/ContactListItem';
import { ContactCheckbox as ContactCheckboxComponent } from './conversationList/ContactCheckbox';
import { PhoneNumberCheckbox as PhoneNumberCheckboxComponent } from './conversationList/PhoneNumberCheckbox';
import { UsernameCheckbox as UsernameCheckboxComponent } from './conversationList/UsernameCheckbox';
import {
  ComposeStepButton,
  Icon as ComposeStepButtonIcon,
} from './conversationList/ComposeStepButton';
import { StartNewConversation as StartNewConversationComponent } from './conversationList/StartNewConversation';
import { SearchResultsLoadingFakeHeader as SearchResultsLoadingFakeHeaderComponent } from './conversationList/SearchResultsLoadingFakeHeader';
import { SearchResultsLoadingFakeRow as SearchResultsLoadingFakeRowComponent } from './conversationList/SearchResultsLoadingFakeRow';
import { UsernameSearchResultListItem } from './conversationList/UsernameSearchResultListItem';
import { GroupListItem } from './conversationList/GroupListItem';
import { ListView } from './ListView';
import { Button, ButtonVariant } from './Button';

export enum RowType {
  ArchiveButton = 'ArchiveButton',
  Blank = 'Blank',
  Contact = 'Contact',
  ClearFilterButton = 'ClearFilterButton',
  ContactCheckbox = 'ContactCheckbox',
  PhoneNumberCheckbox = 'PhoneNumberCheckbox',
  UsernameCheckbox = 'UsernameCheckbox',
  Conversation = 'Conversation',
  CreateNewGroup = 'CreateNewGroup',
  FindByUsername = 'FindByUsername',
  FindByPhoneNumber = 'FindByPhoneNumber',
  Header = 'Header',
  MessageSearchResult = 'MessageSearchResult',
  SearchResultsLoadingFakeHeader = 'SearchResultsLoadingFakeHeader',
  SearchResultsLoadingFakeRow = 'SearchResultsLoadingFakeRow',
  // this could later be expanded to SelectSingleConversation
  SelectSingleGroup = 'SelectSingleGroup',
  StartNewConversation = 'StartNewConversation',
  UsernameSearchResult = 'UsernameSearchResult',
}

type ArchiveButtonRowType = {
  type: RowType.ArchiveButton;
  archivedConversationsCount: number;
};

type BlankRowType = { type: RowType.Blank };

type ContactRowType = {
  type: RowType.Contact;
  contact: ContactListItemPropsType;
  isClickable?: boolean;
  hasContextMenu?: boolean;
};

type ClearFilterButtonRowType = {
  type: RowType.ClearFilterButton;
  isOnNoResultsPage: boolean;
};

type ContactCheckboxRowType = {
  type: RowType.ContactCheckbox;
  contact: ContactListItemPropsType;
  isChecked: boolean;
  disabledReason?: ContactCheckboxDisabledReason;
};

type PhoneNumberCheckboxRowType = {
  type: RowType.PhoneNumberCheckbox;
  phoneNumber: ParsedE164Type;
  isChecked: boolean;
  isFetching: boolean;
};

type UsernameCheckboxRowType = {
  type: RowType.UsernameCheckbox;
  username: string;
  isChecked: boolean;
  isFetching: boolean;
};

type ConversationRowType = {
  type: RowType.Conversation;
  conversation: ConversationListItemPropsType;
};

type CreateNewGroupRowType = {
  type: RowType.CreateNewGroup;
};

type FindByUsername = {
  type: RowType.FindByUsername;
};

type FindByPhoneNumber = {
  type: RowType.FindByPhoneNumber;
};

type MessageRowType = {
  type: RowType.MessageSearchResult;
  messageId: string;
};

type HeaderRowType = {
  type: RowType.Header;
  getHeaderText: (i18n: LocalizerType) => string;
};

// Exported for tests across multiple files
export function _testHeaderText(row: Row | void): string | null {
  if (row?.type === RowType.Header) {
    return row.getHeaderText(((key: string) => key) as LocalizerType);
  }
  return null;
}

type SearchResultsLoadingFakeHeaderType = {
  type: RowType.SearchResultsLoadingFakeHeader;
};

type SearchResultsLoadingFakeRowType = {
  type: RowType.SearchResultsLoadingFakeRow;
};

type SelectSingleGroupRowType = {
  type: RowType.SelectSingleGroup;
  group: GroupListItemConversationType;
};

type StartNewConversationRowType = {
  type: RowType.StartNewConversation;
  phoneNumber: ParsedE164Type;
  isFetching: boolean;
};

type UsernameRowType = {
  type: RowType.UsernameSearchResult;
  username: string;
  isFetchingUsername: boolean;
};

export type Row =
  | ArchiveButtonRowType
  | BlankRowType
  | ContactRowType
  | ContactCheckboxRowType
  | ClearFilterButtonRowType
  | PhoneNumberCheckboxRowType
  | UsernameCheckboxRowType
  | ConversationRowType
  | CreateNewGroupRowType
  | FindByUsername
  | FindByPhoneNumber
  | MessageRowType
  | HeaderRowType
  | SearchResultsLoadingFakeHeaderType
  | SearchResultsLoadingFakeRowType
  | StartNewConversationRowType
  | SelectSingleGroupRowType
  | UsernameRowType;

export type PropsType = {
  dimensions?: {
    width: number;
    height: number;
  };
  rowCount: number;
  // If `getRow` is called with an invalid index, it should return `undefined`. However,
  //   this should only happen if there is a bug somewhere. For example, an inaccurate
  //   `rowCount`.
  getRow: (index: number) => undefined | Row;
  scrollBehavior?: ScrollBehavior;
  scrollToRowIndex?: number;
  shouldRecomputeRowHeights: boolean;
  scrollable?: boolean;
  hasDialogPadding?: boolean;

  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  theme: ThemeType;

  blockConversation: (conversationId: string) => void;
  onClickArchiveButton: () => void;
  onClickContactCheckbox: (
    conversationId: string,
    disabledReason: undefined | ContactCheckboxDisabledReason
  ) => void;
  onClickClearFilterButton: () => void;
  onPreloadConversation: (conversationId: string, messageId?: string) => void;
  onSelectConversation: (conversationId: string, messageId?: string) => void;
  onOutgoingAudioCallInConversation: (conversationId: string) => void;
  onOutgoingVideoCallInConversation: (conversationId: string) => void;
  removeConversation: (conversationId: string) => void;
  renderMessageSearchResult?: (id: string) => JSX.Element;
  showChooseGroupMembers: () => void;
  showFindByUsername: () => void;
  showFindByPhoneNumber: () => void;
  showConversation: ShowConversationType;
} & LookupConversationWithoutServiceIdActionsType;

const NORMAL_ROW_HEIGHT = 76;
const SELECT_ROW_HEIGHT = 52;
const HEADER_ROW_HEIGHT = 40;

export function ConversationList({
  dimensions,
  getPreferredBadge,
  getRow,
  i18n,
  blockConversation,
  onClickArchiveButton,
  onClickContactCheckbox,
  onClickClearFilterButton,
  onPreloadConversation,
  onSelectConversation,
  onOutgoingAudioCallInConversation,
  onOutgoingVideoCallInConversation,
  removeConversation,
  renderMessageSearchResult,
  rowCount,
  scrollBehavior = ScrollBehavior.Default,
  scrollToRowIndex,
  scrollable = true,
  hasDialogPadding = false,
  shouldRecomputeRowHeights,
  showChooseGroupMembers,
  showFindByUsername,
  showFindByPhoneNumber,
  lookupConversationWithoutServiceId,
  showUserNotFoundModal,
  setIsFetchingUUID,
  showConversation,
  theme,
}: PropsType): JSX.Element | null {
  const calculateRowHeight = useCallback(
    (index: number): number => {
      const row = getRow(index);
      if (!row) {
        assertDev(false, `Expected a row at index ${index}`);
        return NORMAL_ROW_HEIGHT;
      }
      switch (row.type) {
        case RowType.Header:
        case RowType.SearchResultsLoadingFakeHeader:
          return HEADER_ROW_HEIGHT;
        case RowType.SelectSingleGroup:
        case RowType.ContactCheckbox:
        case RowType.Contact:
        case RowType.CreateNewGroup:
        case RowType.FindByUsername:
        case RowType.FindByPhoneNumber:
          return SELECT_ROW_HEIGHT;
        default:
          return NORMAL_ROW_HEIGHT;
      }
    },
    [getRow]
  );

  const renderRow: ListRowRenderer = useCallback(
    ({ key, index, style }) => {
      const row = getRow(index);
      if (!row) {
        assertDev(false, `Expected a row at index ${index}`);
        return <div key={key} style={style} />;
      }

      let result: ReactNode;
      switch (row.type) {
        case RowType.ArchiveButton:
          result = (
            <button
              aria-label={i18n('icu:archivedConversations')}
              className="module-conversation-list__item--archive-button"
              onClick={onClickArchiveButton}
              type="button"
            >
              <div className="module-conversation-list__item--archive-button__icon" />
              <span className="module-conversation-list__item--archive-button__text">
                {i18n('icu:archivedConversations')}
              </span>
              <span className="module-conversation-list__item--archive-button__archived-count">
                {row.archivedConversationsCount}
              </span>
            </button>
          );
          break;
        case RowType.Blank:
          result = undefined;
          break;
        case RowType.Contact: {
          const { isClickable = true, hasContextMenu = false } = row;
          result = (
            <ContactListItem
              {...row.contact}
              badge={getPreferredBadge(row.contact.badges)}
              onClick={isClickable ? onSelectConversation : undefined}
              i18n={i18n}
              theme={theme}
              hasContextMenu={hasContextMenu}
              onAudioCall={
                isClickable ? onOutgoingAudioCallInConversation : undefined
              }
              onVideoCall={
                isClickable ? onOutgoingVideoCallInConversation : undefined
              }
              onBlock={isClickable ? blockConversation : undefined}
              onRemove={isClickable ? removeConversation : undefined}
            />
          );
          break;
        }
        case RowType.ContactCheckbox:
          result = (
            <ContactCheckboxComponent
              {...row.contact}
              badge={getPreferredBadge(row.contact.badges)}
              isChecked={row.isChecked}
              disabledReason={row.disabledReason}
              onClick={onClickContactCheckbox}
              i18n={i18n}
              theme={theme}
            />
          );
          break;
        case RowType.ClearFilterButton:
          result = (
            <div className="ClearFilterButton module-conversation-list__item--clear-filter-button">
              <Button
                variant={ButtonVariant.SecondaryAffirmative}
                className={classNames('ClearFilterButton__inner', {
                  // The clear filter button should be closer to the empty state
                  // text than to the search results.
                  'ClearFilterButton__inner-vertical-center':
                    !row.isOnNoResultsPage,
                })}
                onClick={onClickClearFilterButton}
              >
                {i18n('icu:clearFilterButton')}
              </Button>
            </div>
          );
          break;
        case RowType.PhoneNumberCheckbox:
          result = (
            <PhoneNumberCheckboxComponent
              phoneNumber={row.phoneNumber}
              lookupConversationWithoutServiceId={
                lookupConversationWithoutServiceId
              }
              showUserNotFoundModal={showUserNotFoundModal}
              setIsFetchingUUID={setIsFetchingUUID}
              toggleConversationInChooseMembers={conversationId =>
                onClickContactCheckbox(conversationId, undefined)
              }
              isChecked={row.isChecked}
              isFetching={row.isFetching}
              i18n={i18n}
              theme={theme}
            />
          );
          break;
        case RowType.UsernameCheckbox:
          result = (
            <UsernameCheckboxComponent
              username={row.username}
              lookupConversationWithoutServiceId={
                lookupConversationWithoutServiceId
              }
              showUserNotFoundModal={showUserNotFoundModal}
              setIsFetchingUUID={setIsFetchingUUID}
              toggleConversationInChooseMembers={conversationId =>
                onClickContactCheckbox(conversationId, undefined)
              }
              isChecked={row.isChecked}
              isFetching={row.isFetching}
              i18n={i18n}
              theme={theme}
            />
          );
          break;
        case RowType.Conversation: {
          const itemProps = pick(row.conversation, [
            'acceptedMessageRequest',
            'avatarUrl',
            'badges',
            'color',
            'draftPreview',
            'groupId',
            'id',
            'isBlocked',
            'isMe',
            'isSelected',
            'isPinned',
            'lastMessage',
            'lastUpdated',
            'markedUnread',
            'muteExpiresAt',
            'phoneNumber',
            'profileName',
            'removalStage',
            'sharedGroupNames',
            'shouldShowDraft',
            'title',
            'type',
            'typingContactIdTimestamps',
            'unblurredAvatarUrl',
            'unreadCount',
            'unreadMentionsCount',
            'serviceId',
          ]);
          const { badges, title, unreadCount, lastMessage } = itemProps;
          result = (
            <ConversationListItem
              {...itemProps}
              buttonAriaLabel={i18n('icu:ConversationList__aria-label', {
                lastMessage:
                  get(lastMessage, 'text') ||
                  i18n('icu:ConversationList__last-message-undefined'),
                title,
                unreadCount: unreadCount ?? 0,
              })}
              key={key}
              badge={getPreferredBadge(badges)}
              onMouseDown={onPreloadConversation}
              onClick={onSelectConversation}
              i18n={i18n}
              theme={theme}
            />
          );
          break;
        }
        case RowType.CreateNewGroup:
          result = (
            <ComposeStepButton
              icon={ComposeStepButtonIcon.Group}
              title={i18n('icu:createNewGroupButton')}
              onClick={showChooseGroupMembers}
            />
          );
          break;
        case RowType.FindByUsername:
          result = (
            <ComposeStepButton
              icon={ComposeStepButtonIcon.Username}
              title={i18n('icu:LeftPane__compose__findByUsername')}
              onClick={showFindByUsername}
            />
          );
          break;
        case RowType.FindByPhoneNumber:
          result = (
            <ComposeStepButton
              icon={ComposeStepButtonIcon.PhoneNumber}
              title={i18n('icu:LeftPane__compose__findByPhoneNumber')}
              onClick={showFindByPhoneNumber}
            />
          );
          break;
        case RowType.Header: {
          const headerText = row.getHeaderText(i18n);
          result = (
            <div
              className="module-conversation-list__item--header"
              aria-label={headerText}
            >
              {headerText}
            </div>
          );
          break;
        }
        case RowType.MessageSearchResult:
          result = <>{renderMessageSearchResult?.(row.messageId)}</>;
          break;
        case RowType.SearchResultsLoadingFakeHeader:
          result = <SearchResultsLoadingFakeHeaderComponent />;
          break;
        case RowType.SearchResultsLoadingFakeRow:
          result = <SearchResultsLoadingFakeRowComponent />;
          break;
        case RowType.SelectSingleGroup:
          result = (
            <GroupListItem
              i18n={i18n}
              group={row.group}
              onSelectGroup={onSelectConversation}
            />
          );
          break;
        case RowType.StartNewConversation:
          result = (
            <StartNewConversationComponent
              i18n={i18n}
              phoneNumber={row.phoneNumber}
              isFetching={row.isFetching}
              lookupConversationWithoutServiceId={
                lookupConversationWithoutServiceId
              }
              showUserNotFoundModal={showUserNotFoundModal}
              setIsFetchingUUID={setIsFetchingUUID}
              showConversation={showConversation}
            />
          );
          break;
        case RowType.UsernameSearchResult:
          result = (
            <UsernameSearchResultListItem
              i18n={i18n}
              username={row.username}
              isFetchingUsername={row.isFetchingUsername}
              lookupConversationWithoutServiceId={
                lookupConversationWithoutServiceId
              }
              showUserNotFoundModal={showUserNotFoundModal}
              setIsFetchingUUID={setIsFetchingUUID}
              showConversation={showConversation}
            />
          );
          break;
        default:
          throw missingCaseError(row);
      }

      return (
        <span aria-rowindex={index + 1} role="row" style={style} key={key}>
          <span role="gridcell" aria-colindex={1}>
            {result}
          </span>
        </span>
      );
    },
    [
      blockConversation,
      getPreferredBadge,
      getRow,
      i18n,
      lookupConversationWithoutServiceId,
      onClickArchiveButton,
      onClickClearFilterButton,
      onClickContactCheckbox,
      onOutgoingAudioCallInConversation,
      onOutgoingVideoCallInConversation,
      onPreloadConversation,
      onSelectConversation,
      removeConversation,
      renderMessageSearchResult,
      setIsFetchingUUID,
      showChooseGroupMembers,
      showFindByUsername,
      showFindByPhoneNumber,
      showConversation,
      showUserNotFoundModal,
      theme,
    ]
  );

  if (dimensions == null) {
    return null;
  }

  const widthBreakpoint = getNavSidebarWidthBreakpoint(dimensions.width);

  return (
    <ListView
      className={classNames(
        'module-conversation-list',
        `module-conversation-list--width-${widthBreakpoint}`,
        hasDialogPadding && 'module-conversation-list--has-dialog-padding'
      )}
      width={dimensions.width}
      height={dimensions.height}
      rowCount={rowCount}
      calculateRowHeight={calculateRowHeight}
      rowRenderer={renderRow}
      scrollToIndex={scrollToRowIndex}
      shouldRecomputeRowHeights={shouldRecomputeRowHeights}
      scrollable={scrollable}
      scrollBehavior={scrollBehavior}
    />
  );
}

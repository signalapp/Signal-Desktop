// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { useRef, useEffect, useCallback } from 'react';
import type { ListRowRenderer } from 'react-virtualized';
import { List } from 'react-virtualized';
import classNames from 'classnames';
import { get, pick } from 'lodash';

import { missingCaseError } from '../util/missingCaseError';
import { assert } from '../util/assert';
import type { ParsedE164Type } from '../util/libphonenumberInstance';
import type { LocalizerType, ThemeType } from '../types/Util';
import { ScrollBehavior } from '../types/Util';
import { getConversationListWidthBreakpoint } from './_util';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import type { LookupConversationWithoutUuidActionsType } from '../util/lookupConversationWithoutUuid';
import type { ShowConversationType } from '../state/ducks/conversations';

import type { PropsData as ConversationListItemPropsType } from './conversationList/ConversationListItem';
import { ConversationListItem } from './conversationList/ConversationListItem';
import type { ContactListItemConversationType as ContactListItemPropsType } from './conversationList/ContactListItem';
import { ContactListItem } from './conversationList/ContactListItem';
import type { ContactCheckboxDisabledReason } from './conversationList/ContactCheckbox';
import { ContactCheckbox as ContactCheckboxComponent } from './conversationList/ContactCheckbox';
import { PhoneNumberCheckbox as PhoneNumberCheckboxComponent } from './conversationList/PhoneNumberCheckbox';
import { UsernameCheckbox as UsernameCheckboxComponent } from './conversationList/UsernameCheckbox';
import { CreateNewGroupButton } from './conversationList/CreateNewGroupButton';
import { StartNewConversation as StartNewConversationComponent } from './conversationList/StartNewConversation';
import { SearchResultsLoadingFakeHeader as SearchResultsLoadingFakeHeaderComponent } from './conversationList/SearchResultsLoadingFakeHeader';
import { SearchResultsLoadingFakeRow as SearchResultsLoadingFakeRowComponent } from './conversationList/SearchResultsLoadingFakeRow';
import { UsernameSearchResultListItem } from './conversationList/UsernameSearchResultListItem';

export enum RowType {
  ArchiveButton = 'ArchiveButton',
  Blank = 'Blank',
  Contact = 'Contact',
  ContactCheckbox = 'ContactCheckbox',
  PhoneNumberCheckbox = 'PhoneNumberCheckbox',
  UsernameCheckbox = 'UsernameCheckbox',
  Conversation = 'Conversation',
  CreateNewGroup = 'CreateNewGroup',
  Header = 'Header',
  MessageSearchResult = 'MessageSearchResult',
  SearchResultsLoadingFakeHeader = 'SearchResultsLoadingFakeHeader',
  SearchResultsLoadingFakeRow = 'SearchResultsLoadingFakeRow',
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

type MessageRowType = {
  type: RowType.MessageSearchResult;
  messageId: string;
};

type HeaderRowType = {
  type: RowType.Header;
  i18nKey: string;
};

type SearchResultsLoadingFakeHeaderType = {
  type: RowType.SearchResultsLoadingFakeHeader;
};

type SearchResultsLoadingFakeRowType = {
  type: RowType.SearchResultsLoadingFakeRow;
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
  | PhoneNumberCheckboxRowType
  | UsernameCheckboxRowType
  | ConversationRowType
  | CreateNewGroupRowType
  | MessageRowType
  | HeaderRowType
  | SearchResultsLoadingFakeHeaderType
  | SearchResultsLoadingFakeRowType
  | StartNewConversationRowType
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

  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  theme: ThemeType;

  onClickArchiveButton: () => void;
  onClickContactCheckbox: (
    conversationId: string,
    disabledReason: undefined | ContactCheckboxDisabledReason
  ) => void;
  onSelectConversation: (conversationId: string, messageId?: string) => void;
  renderMessageSearchResult: (id: string) => JSX.Element;
  showChooseGroupMembers: () => void;
  showConversation: ShowConversationType;
} & LookupConversationWithoutUuidActionsType;

const NORMAL_ROW_HEIGHT = 76;
const HEADER_ROW_HEIGHT = 40;

export const ConversationList: React.FC<PropsType> = ({
  dimensions,
  getPreferredBadge,
  getRow,
  i18n,
  onClickArchiveButton,
  onClickContactCheckbox,
  onSelectConversation,
  renderMessageSearchResult,
  rowCount,
  scrollBehavior = ScrollBehavior.Default,
  scrollToRowIndex,
  scrollable = true,
  shouldRecomputeRowHeights,
  showChooseGroupMembers,
  lookupConversationWithoutUuid,
  showUserNotFoundModal,
  setIsFetchingUUID,
  showConversation,
  theme,
}) => {
  const listRef = useRef<null | List>(null);

  useEffect(() => {
    const list = listRef.current;
    if (shouldRecomputeRowHeights && list) {
      list.recomputeRowHeights();
    }
  });

  const calculateRowHeight = useCallback(
    ({ index }: { index: number }): number => {
      const row = getRow(index);
      if (!row) {
        assert(false, `Expected a row at index ${index}`);
        return NORMAL_ROW_HEIGHT;
      }
      switch (row.type) {
        case RowType.Header:
        case RowType.SearchResultsLoadingFakeHeader:
          return HEADER_ROW_HEIGHT;
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
        assert(false, `Expected a row at index ${index}`);
        return <div key={key} style={style} />;
      }

      let result: ReactNode;
      switch (row.type) {
        case RowType.ArchiveButton:
          result = (
            <button
              aria-label={i18n('archivedConversations')}
              className="module-conversation-list__item--archive-button"
              onClick={onClickArchiveButton}
              type="button"
            >
              <div className="module-conversation-list__item--archive-button__icon" />
              <span className="module-conversation-list__item--archive-button__text">
                {i18n('archivedConversations')}
              </span>
              <span className="module-conversation-list__item--archive-button__archived-count">
                {row.archivedConversationsCount}
              </span>
            </button>
          );
          break;
        case RowType.Blank:
          result = <></>;
          break;
        case RowType.Contact: {
          const { isClickable = true } = row;
          result = (
            <ContactListItem
              {...row.contact}
              badge={getPreferredBadge(row.contact.badges)}
              onClick={isClickable ? onSelectConversation : undefined}
              i18n={i18n}
              theme={theme}
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
        case RowType.PhoneNumberCheckbox:
          result = (
            <PhoneNumberCheckboxComponent
              phoneNumber={row.phoneNumber}
              lookupConversationWithoutUuid={lookupConversationWithoutUuid}
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
              lookupConversationWithoutUuid={lookupConversationWithoutUuid}
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
            'avatarPath',
            'badges',
            'color',
            'draftPreview',
            'id',
            'isMe',
            'isSelected',
            'isPinned',
            'lastMessage',
            'lastUpdated',
            'markedUnread',
            'muteExpiresAt',
            'name',
            'phoneNumber',
            'profileName',
            'sharedGroupNames',
            'shouldShowDraft',
            'title',
            'type',
            'typingContactId',
            'unblurredAvatarPath',
            'unreadCount',
          ]);
          const { badges, title, unreadCount, lastMessage } = itemProps;
          result = (
            <div
              aria-label={i18n('ConversationList__aria-label', {
                lastMessage:
                  get(lastMessage, 'text') ||
                  i18n('ConversationList__last-message-undefined'),
                title,
                unreadCount: String(unreadCount),
              })}
            >
              <ConversationListItem
                {...itemProps}
                key={key}
                badge={getPreferredBadge(badges)}
                onClick={onSelectConversation}
                i18n={i18n}
                theme={theme}
              />
            </div>
          );
          break;
        }
        case RowType.CreateNewGroup:
          result = (
            <CreateNewGroupButton
              i18n={i18n}
              onClick={showChooseGroupMembers}
            />
          );
          break;
        case RowType.Header:
          result = (
            <div
              className="module-conversation-list__item--header"
              aria-label={i18n(row.i18nKey)}
            >
              {i18n(row.i18nKey)}
            </div>
          );
          break;
        case RowType.MessageSearchResult:
          result = <>{renderMessageSearchResult(row.messageId)}</>;
          break;
        case RowType.SearchResultsLoadingFakeHeader:
          result = <SearchResultsLoadingFakeHeaderComponent />;
          break;
        case RowType.SearchResultsLoadingFakeRow:
          result = <SearchResultsLoadingFakeRowComponent />;
          break;
        case RowType.StartNewConversation:
          result = (
            <StartNewConversationComponent
              i18n={i18n}
              phoneNumber={row.phoneNumber}
              isFetching={row.isFetching}
              lookupConversationWithoutUuid={lookupConversationWithoutUuid}
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
              lookupConversationWithoutUuid={lookupConversationWithoutUuid}
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
      getPreferredBadge,
      getRow,
      i18n,
      onClickArchiveButton,
      onClickContactCheckbox,
      onSelectConversation,
      lookupConversationWithoutUuid,
      showUserNotFoundModal,
      setIsFetchingUUID,
      renderMessageSearchResult,
      showChooseGroupMembers,
      showConversation,
      theme,
    ]
  );

  // Though `width` and `height` are required properties, we want to be careful in case
  //   the caller sends bogus data. Notably, react-measure's types seem to be inaccurate.
  const { width = 0, height = 0 } = dimensions || {};
  if (!width || !height) {
    return null;
  }

  const widthBreakpoint = getConversationListWidthBreakpoint(width);

  return (
    <List
      className={classNames(
        'module-conversation-list',
        `module-conversation-list--scroll-behavior-${scrollBehavior}`,
        `module-conversation-list--width-${widthBreakpoint}`
      )}
      height={height}
      ref={listRef}
      rowCount={rowCount}
      rowHeight={calculateRowHeight}
      rowRenderer={renderRow}
      scrollToIndex={scrollToRowIndex}
      style={{
        // See `<Timeline>` for an explanation of this `any` cast.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        overflowY: scrollable ? ('overlay' as any) : 'hidden',
      }}
      tabIndex={-1}
      width={width}
    />
  );
};

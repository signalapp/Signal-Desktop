// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useRef, useEffect, useCallback, ReactNode } from 'react';
import { List, ListRowRenderer } from 'react-virtualized';
import classNames from 'classnames';
import { pick } from 'lodash';

import { missingCaseError } from '../util/missingCaseError';
import { assert } from '../util/assert';
import { LocalizerType, ScrollBehavior } from '../types/Util';

import {
  ConversationListItem,
  PropsData as ConversationListItemPropsType,
} from './conversationList/ConversationListItem';
import {
  ContactListItem,
  PropsDataType as ContactListItemPropsType,
} from './conversationList/ContactListItem';
import {
  ContactCheckbox as ContactCheckboxComponent,
  ContactCheckboxDisabledReason,
} from './conversationList/ContactCheckbox';
import { CreateNewGroupButton } from './conversationList/CreateNewGroupButton';
import { StartNewConversation as StartNewConversationComponent } from './conversationList/StartNewConversation';
import { SearchResultsLoadingFakeHeader as SearchResultsLoadingFakeHeaderComponent } from './conversationList/SearchResultsLoadingFakeHeader';
import { SearchResultsLoadingFakeRow as SearchResultsLoadingFakeRowComponent } from './conversationList/SearchResultsLoadingFakeRow';

export enum RowType {
  ArchiveButton,
  Blank,
  Contact,
  ContactCheckbox,
  Conversation,
  CreateNewGroup,
  Header,
  MessageSearchResult,
  SearchResultsLoadingFakeHeader,
  SearchResultsLoadingFakeRow,
  StartNewConversation,
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
  phoneNumber: string;
};

export type Row =
  | ArchiveButtonRowType
  | BlankRowType
  | ContactRowType
  | ContactCheckboxRowType
  | ConversationRowType
  | CreateNewGroupRowType
  | MessageRowType
  | HeaderRowType
  | SearchResultsLoadingFakeHeaderType
  | SearchResultsLoadingFakeRowType
  | StartNewConversationRowType;

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

  i18n: LocalizerType;

  onClickArchiveButton: () => void;
  onClickContactCheckbox: (
    conversationId: string,
    disabledReason: undefined | ContactCheckboxDisabledReason
  ) => void;
  onSelectConversation: (conversationId: string, messageId?: string) => void;
  renderMessageSearchResult: (id: string) => JSX.Element;
  showChooseGroupMembers: () => void;
  startNewConversationFromPhoneNumber: (e164: string) => void;
};

const NORMAL_ROW_HEIGHT = 68;
const HEADER_ROW_HEIGHT = 40;

export const ConversationList: React.FC<PropsType> = ({
  dimensions,
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
  startNewConversationFromPhoneNumber,
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
              onClick={isClickable ? onSelectConversation : undefined}
              i18n={i18n}
            />
          );
          break;
        }
        case RowType.ContactCheckbox:
          result = (
            <ContactCheckboxComponent
              {...row.contact}
              isChecked={row.isChecked}
              disabledReason={row.disabledReason}
              onClick={onClickContactCheckbox}
              i18n={i18n}
            />
          );
          break;
        case RowType.Conversation: {
          const itemProps = pick(row.conversation, [
            'acceptedMessageRequest',
            'avatarPath',
            'color',
            'draftPreview',
            'id',
            'isMe',
            'isSelected',
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
            'typingContact',
            'unblurredAvatarPath',
            'unreadCount',
          ]);
          result = (
            <ConversationListItem
              {...itemProps}
              key={key}
              onClick={onSelectConversation}
              i18n={i18n}
            />
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
            <div className="module-conversation-list__item--header">
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
              onClick={startNewConversationFromPhoneNumber}
            />
          );
          break;
        default:
          throw missingCaseError(row);
      }

      return (
        <span style={style} key={key}>
          {result}
        </span>
      );
    },
    [
      getRow,
      i18n,
      onClickArchiveButton,
      onClickContactCheckbox,
      onSelectConversation,
      renderMessageSearchResult,
      showChooseGroupMembers,
      startNewConversationFromPhoneNumber,
    ]
  );

  // Though `width` and `height` are required properties, we want to be careful in case
  //   the caller sends bogus data. Notably, react-measure's types seem to be inaccurate.
  const { width = 0, height = 0 } = dimensions || {};
  if (!width || !height) {
    return null;
  }

  return (
    <List
      className={classNames(
        'module-conversation-list',
        `module-conversation-list--scroll-behavior-${scrollBehavior}`
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

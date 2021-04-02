// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useRef, useEffect, useCallback, CSSProperties } from 'react';
import { List, ListRowRenderer } from 'react-virtualized';
import classNames from 'classnames';

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
  renderMessageSearchResult: (id: string, style: CSSProperties) => JSX.Element;
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
  }, [shouldRecomputeRowHeights]);

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

      switch (row.type) {
        case RowType.ArchiveButton:
          return (
            <button
              key={key}
              className="module-conversation-list__item--archive-button"
              style={style}
              onClick={onClickArchiveButton}
              type="button"
            >
              {i18n('archivedConversations')}{' '}
              <span className="module-conversation-list__item--archive-button__archived-count">
                {row.archivedConversationsCount}
              </span>
            </button>
          );
        case RowType.Blank:
          return <div key={key} style={style} />;
        case RowType.Contact: {
          const { isClickable = true } = row;
          return (
            <ContactListItem
              {...row.contact}
              key={key}
              style={style}
              onClick={isClickable ? onSelectConversation : undefined}
              i18n={i18n}
            />
          );
        }
        case RowType.ContactCheckbox:
          return (
            <ContactCheckboxComponent
              {...row.contact}
              isChecked={row.isChecked}
              disabledReason={row.disabledReason}
              key={key}
              style={style}
              onClick={onClickContactCheckbox}
              i18n={i18n}
            />
          );
        case RowType.Conversation:
          return (
            <ConversationListItem
              {...row.conversation}
              key={key}
              style={style}
              onClick={onSelectConversation}
              i18n={i18n}
            />
          );
        case RowType.CreateNewGroup:
          return (
            <CreateNewGroupButton
              i18n={i18n}
              key={key}
              onClick={showChooseGroupMembers}
              style={style}
            />
          );
        case RowType.Header:
          return (
            <div
              className="module-conversation-list__item--header"
              key={key}
              style={style}
            >
              {i18n(row.i18nKey)}
            </div>
          );
        case RowType.MessageSearchResult:
          return (
            <React.Fragment key={key}>
              {renderMessageSearchResult(row.messageId, style)}
            </React.Fragment>
          );
        case RowType.SearchResultsLoadingFakeHeader:
          return (
            <SearchResultsLoadingFakeHeaderComponent key={key} style={style} />
          );
        case RowType.SearchResultsLoadingFakeRow:
          return (
            <SearchResultsLoadingFakeRowComponent key={key} style={style} />
          );
        case RowType.StartNewConversation:
          return (
            <StartNewConversationComponent
              i18n={i18n}
              key={key}
              phoneNumber={row.phoneNumber}
              onClick={() => {
                startNewConversationFromPhoneNumber(row.phoneNumber);
              }}
              style={style}
            />
          );
        default:
          throw missingCaseError(row);
      }
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
      style={{ overflow: scrollable ? 'auto' : 'hidden' }}
      tabIndex={-1}
      width={width}
    />
  );
};

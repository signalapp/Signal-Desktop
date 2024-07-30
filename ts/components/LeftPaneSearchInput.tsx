// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useRef } from 'react';
import type {
  ConversationType,
  ShowConversationType,
} from '../state/ducks/conversations';
import type { LocalizerType } from '../types/Util';
import { Avatar, AvatarSize } from './Avatar';
import { SearchInput } from './SearchInput';
import { usePrevious } from '../hooks/usePrevious';

type PropsType = {
  clearConversationSearch: () => void;
  clearSearch: () => void;
  disabled?: boolean;
  endConversationSearch: () => void;
  endSearch: () => void;
  i18n: LocalizerType;
  isSearchingGlobally: boolean;
  onEnterKeyDown?: (
    clearSearch: () => void,
    showConversation: ShowConversationType
  ) => void;
  searchConversation?: ConversationType;
  searchTerm: string;
  showConversation: ShowConversationType;
  startSearchCounter: number;
  updateSearchTerm: (searchTerm: string) => void;
};

export function LeftPaneSearchInput({
  clearConversationSearch,
  clearSearch,
  disabled,
  endConversationSearch,
  endSearch,
  i18n,
  isSearchingGlobally,
  onEnterKeyDown,
  searchConversation,
  searchTerm,
  showConversation,
  startSearchCounter,
  updateSearchTerm,
}: PropsType): JSX.Element {
  const inputRef = useRef<null | HTMLInputElement>(null);

  const prevSearchConversationId = usePrevious(
    undefined,
    searchConversation?.id
  );
  const prevSearchCounter = usePrevious(startSearchCounter, startSearchCounter);
  const wasSearchingGlobally = usePrevious(false, isSearchingGlobally);

  useEffect(() => {
    // When user chooses to search in a given conversation we focus the field for them
    if (
      searchConversation &&
      searchConversation.id !== prevSearchConversationId
    ) {
      inputRef.current?.focus();
    }
    // When user chooses to start a new search, we focus the field
    if (
      (isSearchingGlobally && !wasSearchingGlobally) ||
      startSearchCounter !== prevSearchCounter
    ) {
      inputRef.current?.select();
    }
  }, [
    prevSearchConversationId,
    prevSearchCounter,
    searchConversation,
    startSearchCounter,
    isSearchingGlobally,
    wasSearchingGlobally,
  ]);

  const changeValue = (nextSearchTerm: string) => {
    if (!nextSearchTerm) {
      if (searchConversation) {
        clearConversationSearch();
      } else {
        clearSearch();
      }

      return;
    }

    if (updateSearchTerm) {
      updateSearchTerm(nextSearchTerm);
    }
  };

  const label = searchConversation ? i18n('icu:searchIn') : i18n('icu:search');

  return (
    <SearchInput
      disabled={disabled}
      label={label}
      hasSearchIcon={!searchConversation}
      i18n={i18n}
      moduleClassName="LeftPaneSearchInput"
      onBlur={() => {
        if (!searchConversation && !searchTerm) {
          endSearch();
        }
      }}
      onKeyDown={event => {
        if (onEnterKeyDown && event.key === 'Enter') {
          onEnterKeyDown(clearSearch, showConversation);
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onChange={event => {
        changeValue(event.currentTarget.value);
      }}
      onClear={() => {
        if (searchTerm) {
          clearSearch();
          inputRef.current?.focus();
        } else if (searchConversation) {
          endConversationSearch();
          inputRef.current?.focus();
        } else {
          inputRef.current?.blur();
        }
      }}
      ref={inputRef}
      placeholder={label}
      value={searchTerm}
    >
      {searchConversation && (
        // Clicking the non-X part of the pill should focus the input but have a normal
        //   cursor. This effectively simulates `pointer-events: none` while still
        //   letting us change the cursor.
        // eslint-disable-next-line max-len
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div
          className="LeftPaneSearchInput__in-conversation-pill"
          onClick={() => {
            inputRef.current?.focus();
          }}
        >
          <Avatar
            acceptedMessageRequest={searchConversation.acceptedMessageRequest}
            avatarUrl={searchConversation.avatarUrl}
            badge={undefined}
            color={searchConversation.color}
            conversationType={searchConversation.type}
            i18n={i18n}
            isMe={searchConversation.isMe}
            noteToSelf={searchConversation.isMe}
            sharedGroupNames={searchConversation.sharedGroupNames}
            size={AvatarSize.TWENTY}
            title={searchConversation.title}
            unblurredAvatarUrl={searchConversation.unblurredAvatarUrl}
          />
          <button
            aria-label={i18n('icu:clearSearch')}
            className="LeftPaneSearchInput__in-conversation-pill__x-button"
            onClick={endConversationSearch}
            type="button"
          />
        </div>
      )}
    </SearchInput>
  );
}

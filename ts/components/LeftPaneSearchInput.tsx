// Copyright 2021-2022 Signal Messenger, LLC
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
  i18n: LocalizerType;
  searchConversation?: ConversationType;
  searchTerm: string;
  startSearchCounter: number;
  updateSearchTerm: (searchTerm: string) => void;
  showConversation: ShowConversationType;
  onEnterKeyDown?: (
    clearSearch: () => void,
    showConversation: ShowConversationType
  ) => void;
};

export const LeftPaneSearchInput = ({
  clearConversationSearch,
  clearSearch,
  disabled,
  i18n,
  searchConversation,
  searchTerm,
  startSearchCounter,
  updateSearchTerm,
  showConversation,
  onEnterKeyDown,
}: PropsType): JSX.Element => {
  const inputRef = useRef<null | HTMLInputElement>(null);

  const prevSearchConversationId = usePrevious(
    undefined,
    searchConversation?.id
  );
  const prevSearchCounter = usePrevious(startSearchCounter, startSearchCounter);

  useEffect(() => {
    // When user chooses to search in a given conversation we focus the field for them
    if (
      searchConversation &&
      searchConversation.id !== prevSearchConversationId
    ) {
      inputRef.current?.focus();
    }
    // When user chooses to start a new search, we focus the field
    if (startSearchCounter !== prevSearchCounter) {
      inputRef.current?.select();
    }
  }, [
    prevSearchConversationId,
    prevSearchCounter,
    searchConversation,
    startSearchCounter,
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

  const clearAndFocus = () => {
    clearSearch();
    inputRef.current?.focus();
  };

  const label = i18n(searchConversation ? 'searchIn' : 'search');

  return (
    <SearchInput
      disabled={disabled}
      label={label}
      hasSearchIcon={!searchConversation}
      i18n={i18n}
      moduleClassName="LeftPaneSearchInput"
      onBlur={() => {
        if (!searchConversation && !searchTerm) {
          clearSearch();
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
        if (searchConversation && searchTerm) {
          changeValue('');
        } else {
          clearAndFocus();
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
            avatarPath={searchConversation.avatarPath}
            badge={undefined}
            color={searchConversation.color}
            conversationType={searchConversation.type}
            i18n={i18n}
            isMe={searchConversation.isMe}
            noteToSelf={searchConversation.isMe}
            sharedGroupNames={searchConversation.sharedGroupNames}
            size={AvatarSize.SIXTEEN}
            title={searchConversation.title}
            unblurredAvatarPath={searchConversation.unblurredAvatarPath}
          />
          <button
            aria-label={i18n('clearSearch')}
            className="LeftPaneSearchInput__in-conversation-pill__x-button"
            onClick={clearAndFocus}
            type="button"
          />
        </div>
      )}
    </SearchInput>
  );
};

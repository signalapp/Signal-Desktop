// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useRef } from 'react';

import type { LocalizerType } from '../types/Util';
import type { ConversationType } from '../state/ducks/conversations';
import { LeftPaneSearchInput } from './LeftPaneSearchInput';
import { usePrevious } from '../hooks/usePrevious';

export type PropsType = {
  clearConversationSearch: () => void;
  clearSearch: () => void;
  disabled?: boolean;
  i18n: LocalizerType;
  searchConversation: undefined | ConversationType;
  searchTerm: string;
  startSearchCounter: number;
  updateSearchTerm: (searchTerm: string) => void;
};

export const LeftPaneMainSearchInput = ({
  clearConversationSearch,
  clearSearch,
  disabled,
  i18n,
  searchConversation,
  searchTerm,
  startSearchCounter,
  updateSearchTerm,
}: PropsType): JSX.Element => {
  const inputRef = useRef<HTMLInputElement | null>(null);

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

  return (
    <LeftPaneSearchInput
      disabled={disabled}
      i18n={i18n}
      onBlur={() => {
        if (!searchConversation && !searchTerm) {
          clearSearch();
        }
      }}
      onChangeValue={nextSearchTerm => {
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
      }}
      onClear={() => {
        clearSearch();
        inputRef.current?.focus();
      }}
      ref={inputRef}
      searchConversation={searchConversation}
      value={searchTerm}
    />
  );
};

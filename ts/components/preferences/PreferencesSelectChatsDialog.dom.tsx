// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ChangeEvent } from 'react';
import React, { useCallback, useMemo, useState } from 'react';

import type { ConversationType } from '../../state/ducks/conversations.preload.js';
import type { PreferredBadgeSelectorType } from '../../state/selectors/badges.preload.js';
import type { LocalizerType } from '../../types/I18N.std.js';
import type { ThemeType } from '../../types/Util.std.js';
import { filterAndSortConversations } from '../../util/filterAndSortConversations.std.js';
import { ContactPills } from '../ContactPills.dom.js';
import { ContactPill } from '../ContactPill.dom.js';
import {
  asyncShouldNeverBeCalled,
  shouldNeverBeCalled,
} from '../../util/shouldNeverBeCalled.std.js';
import { SearchInput } from '../SearchInput.dom.js';
import { Button, ButtonVariant } from '../Button.dom.js';
import { Modal } from '../Modal.dom.js';
import type { Row } from '../ConversationList.dom.js';
import {
  ConversationList,
  GenericCheckboxRowIcon,
  RowType,
} from '../ConversationList.dom.js';
import type { GetConversationByIdType } from '../../state/selectors/conversations.dom.js';
import { SizeObserver } from '../../hooks/useSizeObserver.dom.js';
import { tw } from '../../axo/tw.dom.js';

export type ChatFolderSelection = Readonly<{
  selectedRecipientIds: ReadonlyArray<string>;
  selectAllIndividualChats: boolean;
  selectAllGroupChats: boolean;
}>;

export type PreferencesSelectChatsDialogProps = Readonly<{
  i18n: LocalizerType;
  title: string;
  conversations: ReadonlyArray<ConversationType>;
  conversationSelector: GetConversationByIdType;
  onClose: (selection: ChatFolderSelection) => void;
  preferredBadgeSelector: PreferredBadgeSelectorType;
  theme: ThemeType;
  initialSelection: ChatFolderSelection;
  showChatTypes: boolean;
}>;

export function PreferencesSelectChatsDialog(
  props: PreferencesSelectChatsDialogProps
): JSX.Element {
  const {
    i18n,
    conversations,
    conversationSelector,
    initialSelection,
    onClose,
    showChatTypes,
  } = props;
  const [searchInput, setSearchInput] = useState('');

  const [selectAllIndividualChats, setSelectAllIndividualChats] = useState(
    initialSelection.selectAllIndividualChats
  );
  const [selectAllGroupChats, setSelectAllGroupChats] = useState(
    initialSelection.selectAllGroupChats
  );
  const [selectedRecipientIds, setSelectedRecipientIds] = useState(() => {
    return new Set(initialSelection.selectedRecipientIds);
  });

  const handleSearchInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setSearchInput(event.currentTarget.value);
    },
    []
  );

  const filteredConversations = useMemo(() => {
    return filterAndSortConversations(
      conversations,
      searchInput,
      undefined,
      false,
      undefined
    );
  }, [conversations, searchInput]);

  const handleToggleDirectChats = useCallback(() => {
    setSelectAllIndividualChats(value => !value);
  }, []);

  const handleToggleGroupChats = useCallback(() => {
    setSelectAllGroupChats(value => !value);
  }, []);

  const handleToggleSelectedConversation = useCallback(
    (conversationId: string) => {
      setSelectedRecipientIds(prev => {
        const copy = new Set(prev);
        if (copy.has(conversationId)) {
          copy.delete(conversationId);
        } else {
          copy.add(conversationId);
        }
        return copy;
      });
    },
    []
  );

  const rows = useMemo((): ReadonlyArray<Row> => {
    const result: Array<Row> = [];

    if (showChatTypes && searchInput.trim() === '') {
      result.push({
        type: RowType.Header,
        getHeaderText: () => {
          return i18n(
            'icu:Preferences__EditChatFolderPage__SelectChatsDialog__ChatTypesSection__Title'
          );
        },
      });

      result.push({
        type: RowType.GenericCheckbox,
        icon: GenericCheckboxRowIcon.Contact,
        label: i18n(
          'icu:Preferences__EditChatFolderPage__SelectChatsDialog__ChatTypesSection__DirectChats'
        ),
        isChecked: selectAllIndividualChats,
        onClick: handleToggleDirectChats,
      });

      result.push({
        type: RowType.GenericCheckbox,
        icon: GenericCheckboxRowIcon.Group,
        label: i18n(
          'icu:Preferences__EditChatFolderPage__SelectChatsDialog__ChatTypesSection__GroupChats'
        ),
        isChecked: selectAllGroupChats,
        onClick: handleToggleGroupChats,
      });

      result.push({
        type: RowType.Header,
        getHeaderText: () => {
          return i18n(
            'icu:Preferences__EditChatFolderPage__SelectChatsDialog__RecentChats__Title'
          );
        },
      });
    }

    for (const conversation of filteredConversations) {
      result.push({
        type: RowType.ContactCheckbox,
        contact: conversation,
        isChecked: selectedRecipientIds.has(conversation.id),
        disabledReason: undefined,
      });
    }

    if (filteredConversations.length === 0) {
      result.push({
        type: RowType.EmptyResults,
        message: 'No items',
      });
    }

    return result;
  }, [
    i18n,
    searchInput,
    filteredConversations,
    selectAllIndividualChats,
    selectAllGroupChats,
    selectedRecipientIds,
    handleToggleDirectChats,
    handleToggleGroupChats,
    showChatTypes,
  ]);

  const handleClose = useCallback(() => {
    onClose({
      selectAllIndividualChats,
      selectAllGroupChats,
      selectedRecipientIds: Array.from(selectedRecipientIds),
    });
  }, [
    onClose,
    selectAllIndividualChats,
    selectAllGroupChats,
    selectedRecipientIds,
  ]);

  return (
    <Modal
      modalName="Preferences__EditChatFolderPage__SelectChatsDialog"
      moduleClassName="Preferences__EditChatFolderPage__SelectChatsDialog"
      i18n={i18n}
      title={props.title}
      onClose={handleClose}
      padded={false}
      noMouseClose
      hasXButton
      modalFooter={
        <Button variant={ButtonVariant.Primary} onClick={handleClose}>
          {i18n(
            'icu:Preferences__EditChatFolderPage__SelectChatsDialog__DoneButton'
          )}
        </Button>
      }
    >
      <SearchInput
        i18n={i18n}
        placeholder={i18n(
          'icu:Preferences__EditChatFolderPage__SelectChatsDialog__Search__Placeholder'
        )}
        value={searchInput}
        onChange={handleSearchInputChange}
      />
      {selectedRecipientIds.size > 0 && (
        <ContactPills>
          {Array.from(selectedRecipientIds, conversationId => {
            const conversation = conversationSelector(conversationId);
            return (
              <ContactPill
                key={conversationId}
                avatarUrl={conversation.avatarUrl}
                color={conversation.color}
                firstName={conversation.firstName}
                hasAvatar={conversation.hasAvatar}
                i18n={i18n}
                id={conversation.id}
                isMe={conversation.isMe}
                phoneNumber={conversation.phoneNumber}
                profileName={conversation.profileName}
                sharedGroupNames={conversation.sharedGroupNames}
                title={conversation.title}
                onClickRemove={handleToggleSelectedConversation}
              />
            );
          })}
        </ContactPills>
      )}
      <SizeObserver>
        {(ref, size) => {
          return (
            <div ref={ref} className={tw('min-h-[100px] w-full flex-grow')}>
              {size != null && (
                <ConversationList
                  dimensions={size}
                  i18n={i18n}
                  getPreferredBadge={props.preferredBadgeSelector}
                  getRow={index => rows[index]}
                  onClickContactCheckbox={handleToggleSelectedConversation}
                  rowCount={rows.length}
                  shouldRecomputeRowHeights={false}
                  theme={props.theme}
                  // never called:
                  blockConversation={shouldNeverBeCalled}
                  lookupConversationWithoutServiceId={asyncShouldNeverBeCalled}
                  onClickArchiveButton={shouldNeverBeCalled}
                  onClickClearFilterButton={shouldNeverBeCalled}
                  onOutgoingAudioCallInConversation={shouldNeverBeCalled}
                  onOutgoingVideoCallInConversation={shouldNeverBeCalled}
                  onPreloadConversation={shouldNeverBeCalled}
                  onSelectConversation={shouldNeverBeCalled}
                  removeConversation={shouldNeverBeCalled}
                  setIsFetchingUUID={shouldNeverBeCalled}
                  showChooseGroupMembers={shouldNeverBeCalled}
                  showConversation={shouldNeverBeCalled}
                  showFindByPhoneNumber={shouldNeverBeCalled}
                  showFindByUsername={shouldNeverBeCalled}
                  showUserNotFoundModal={shouldNeverBeCalled}
                />
              )}
            </div>
          );
        }}
      </SizeObserver>
    </Modal>
  );
}

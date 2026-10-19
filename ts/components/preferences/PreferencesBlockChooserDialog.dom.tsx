// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useMemo, useState } from 'react';

import type { ChangeEvent, JSX } from 'react';

import { filterAndSortConversations } from '../../util/filterAndSortConversations.std.ts';
import {
  asyncShouldNeverBeCalled,
  shouldNeverBeCalled,
} from '../../util/shouldNeverBeCalled.std.ts';
import { SearchInput } from '../SearchInput.dom.tsx';
import { ConversationList, RowType } from '../ConversationList.dom.tsx';
import { SizeObserver } from '../../hooks/useSizeObserver.dom.tsx';
import { tw } from '../../axo/tw.dom.tsx';
import { AxoDialog } from '../../axo/AxoDialog.dom.tsx';
import { strictAssert } from '../../util/assert.std.ts';
import {
  MessageRequestActionsConfirmation,
  MessageRequestState,
} from '../conversation/MessageRequestActionsConfirmation.dom.tsx';

import type { Row } from '../ConversationList.dom.tsx';
import type { ConversationType } from '../../state/ducks/conversations.preload.ts';
import type { PreferredBadgeSelectorType } from '../../state/selectors/badges.preload.ts';
import type { LocalizerType } from '../../types/I18N.std.ts';
import type { ThemeType } from '../../types/Util.std.ts';
import { isSignalConversation } from '../../util/isSignalConversation.dom.ts';

export type Props = Readonly<{
  i18n: LocalizerType;
  title: string;
  conversations: ReadonlyArray<ConversationType>;
  onBlock: (conversationId: string) => void;
  onClose: () => void;
  open: boolean;
  preferredBadgeSelector: PreferredBadgeSelectorType;
  theme: ThemeType;
}>;

export function PreferencesBlockChooserDialog(props: Props): JSX.Element {
  const { i18n, conversations, onBlock, onClose, open } = props;
  const [searchInput, setSearchInput] = useState('');
  const [showConfirmBlockDialogFor, setShowConfirmBlockDialogFor] = useState<
    ConversationType | undefined
  >(undefined);

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

  const onSelectConversation = useCallback(
    (conversationId: string) => {
      const conversation = conversations.find(
        item => item.id === conversationId
      );
      strictAssert(
        conversation,
        'onSelectConversation: No conversation found!'
      );
      setShowConfirmBlockDialogFor(conversation);
    },
    [conversations, setShowConfirmBlockDialogFor]
  );

  const rows = useMemo((): ReadonlyArray<Row> => {
    const result: Array<Row> = [];

    for (const conversation of filteredConversations) {
      result.push({
        type: RowType.Contact,
        contact: conversation,
      });
    }

    if (filteredConversations.length === 0) {
      result.push({
        type: RowType.EmptyResults,
        message: i18n(
          'icu:Preferences__EditChatFolderPage__SelectChatsDialog__NoChats'
        ),
      });
    }

    return result;
  }, [i18n, filteredConversations]);

  return (
    <AxoDialog.Root
      open={open}
      onOpenChange={newOpen => {
        if (!newOpen) {
          onClose();
        }
      }}
    >
      <AxoDialog.Content size="md" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title>{props.title}</AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Search>
          <SearchInput
            i18n={i18n}
            placeholder={i18n(
              'icu:Preferences--BlockChooser--Search--Placeholder'
            )}
            value={searchInput}
            onChange={handleSearchInputChange}
            noMargin
          />
        </AxoDialog.Search>
        <AxoDialog.Body
          scrollbarWidth="none"
          // ConversationList has its own scroll container so we need to do this
          padding="deprecated-only-scrollbar-gutter"
        >
          <SizeObserver>
            {(ref, size) => {
              return (
                <div ref={ref} className={tw('h-96 w-full')}>
                  {size != null && !size.hidden && (
                    <ConversationList
                      dimensions={size}
                      i18n={i18n}
                      getPreferredBadge={props.preferredBadgeSelector}
                      getRow={index => rows[index]}
                      onSelectConversation={onSelectConversation}
                      rowCount={rows.length}
                      shouldRecomputeRowHeights={false}
                      theme={props.theme}
                      // never called:
                      blockConversation={shouldNeverBeCalled}
                      lookupConversationWithoutServiceId={
                        asyncShouldNeverBeCalled
                      }
                      onClickArchiveButton={shouldNeverBeCalled}
                      onClickClearFilterButton={shouldNeverBeCalled}
                      onClickContactCheckbox={shouldNeverBeCalled}
                      onOutgoingAudioCallInConversation={shouldNeverBeCalled}
                      onOutgoingVideoCallInConversation={shouldNeverBeCalled}
                      onPreloadConversation={shouldNeverBeCalled}
                      removeConversation={shouldNeverBeCalled}
                      resetShouldRecomputeRowHeights={shouldNeverBeCalled}
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
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action variant="strong-primary" onClick={onClose}>
              {i18n('icu:Preferences--BlockChooser--Done')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
      <MessageRequestActionsConfirmation
        addedByName={null}
        conversationId={showConfirmBlockDialogFor?.id ?? ''}
        conversationType={showConfirmBlockDialogFor?.type ?? 'direct'}
        conversationName={showConfirmBlockDialogFor}
        isBlocked={false}
        isSignalConversation={
          showConfirmBlockDialogFor
            ? isSignalConversation(showConfirmBlockDialogFor)
            : false
        }
        isReported={false}
        acceptConversation={shouldNeverBeCalled}
        blockAndReportSpam={shouldNeverBeCalled}
        blockConversation={onBlock}
        reportSpam={shouldNeverBeCalled}
        deleteConversation={shouldNeverBeCalled}
        i18n={i18n}
        state={
          showConfirmBlockDialogFor
            ? MessageRequestState.blocking
            : MessageRequestState.default
        }
        onChangeState={state => {
          if (state === MessageRequestState.default) {
            setShowConfirmBlockDialogFor(undefined);
          }
        }}
      />
    </AxoDialog.Root>
  );
}

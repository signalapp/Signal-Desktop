// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ComponentType } from 'react';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
} from 'react';
import { AttachmentList } from './conversation/AttachmentList.dom.js';
import type { AttachmentForUIType } from '../types/Attachment.std.js';
import { Button } from './Button.dom.js';
import { ConfirmationDialog } from './ConfirmationDialog.dom.js';
import { ContactCheckboxDisabledReason } from './conversationList/ContactCheckbox.dom.js';
import type { Row } from './ConversationList.dom.js';
import { ConversationList, RowType } from './ConversationList.dom.js';
import type { ConversationType } from '../state/ducks/conversations.preload.js';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges.preload.js';
import type { LocalizerType, ThemeType } from '../types/Util.std.js';
import type { SmartCompositionTextAreaProps } from '../state/smart/CompositionTextArea.preload.js';
import { SearchInput } from './SearchInput.dom.js';
import { StagedLinkPreview } from './conversation/StagedLinkPreview.dom.js';
import { filterAndSortConversations } from '../util/filterAndSortConversations.std.js';
import {
  shouldNeverBeCalled,
  asyncShouldNeverBeCalled,
} from '../util/shouldNeverBeCalled.std.js';
import type { LinkPreviewForUIType } from '../types/message/LinkPreviews.std.js';
import { LinkPreviewSourceType } from '../types/LinkPreview.std.js';
import { ToastType } from '../types/Toast.dom.js';
import type { ShowToastAction } from '../state/ducks/toast.preload.js';
import type { HydratedBodyRangesType } from '../types/BodyRange.std.js';
import { applyRangesToText } from '../types/BodyRange.std.js';
import { UserText } from './UserText.dom.js';
import { Modal } from './Modal.dom.js';
import { SizeObserver } from '../hooks/useSizeObserver.dom.js';
import {
  isDraftEditable,
  isDraftForwardable,
  type MessageForwardDraft,
} from '../types/ForwardDraft.std.js';
import { missingCaseError } from '../util/missingCaseError.std.js';
import { Theme } from '../util/theme.std.js';
import { EmojiSkinTone } from './fun/data/emojis.std.js';

export enum ForwardMessagesModalType {
  Forward,
  ShareCallLink,
}

export type DataPropsType = {
  candidateConversations: ReadonlyArray<ConversationType>;
  doForwardMessages: (
    conversationIds: ReadonlyArray<string>,
    drafts: ReadonlyArray<MessageForwardDraft>
  ) => void;
  drafts: ReadonlyArray<MessageForwardDraft>;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  isInFullScreenCall: boolean;

  linkPreviewForSource: (
    source: LinkPreviewSourceType
  ) => LinkPreviewForUIType | void;
  onClose: () => void;
  onChange: (
    updatedDrafts: ReadonlyArray<MessageForwardDraft>,
    caretLocation?: number
  ) => unknown;
  regionCode: string | undefined;
  RenderCompositionTextArea: ComponentType<SmartCompositionTextAreaProps>;
  type: ForwardMessagesModalType;
  showToast: ShowToastAction;
  theme: ThemeType;
};

type ActionPropsType = {
  removeLinkPreview: () => void;
};

export type PropsType = DataPropsType & ActionPropsType;

const MAX_FORWARD = 5;

export function ForwardMessagesModal({
  type,
  drafts,
  candidateConversations,
  doForwardMessages,
  linkPreviewForSource,
  getPreferredBadge,
  i18n,
  isInFullScreenCall,
  onClose,
  onChange,
  removeLinkPreview,
  RenderCompositionTextArea,
  showToast,
  theme,
  regionCode,
}: PropsType): JSX.Element {
  const inputRef = useRef<null | HTMLInputElement>(null);
  const [selectedContacts, setSelectedContacts] = useState<
    Array<ConversationType>
  >([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredConversations, setFilteredConversations] = useState(
    filterAndSortConversations(candidateConversations, '', regionCode)
  );
  const [isEditingMessage, setIsEditingMessage] = useState(false);
  const [cannotMessage, setCannotMessage] = useState(false);

  const isLonelyDraft = drafts.length === 1;
  const lonelyDraft = isLonelyDraft ? drafts[0] : null;
  const isLonelyDraftEditable =
    lonelyDraft != null && isDraftEditable(lonelyDraft);
  const lonelyLinkPreview = isLonelyDraft
    ? linkPreviewForSource(LinkPreviewSourceType.ForwardMessageModal)
    : null;

  const hasSelectedMaximumNumberOfContacts =
    selectedContacts.length >= MAX_FORWARD;

  const selectedConversationIdsSet: Set<string> = useMemo(
    () => new Set(selectedContacts.map(contact => contact.id)),
    [selectedContacts]
  );

  const hasContactsSelected = Boolean(selectedContacts.length);

  const canForwardMessages =
    hasContactsSelected && drafts.every(isDraftForwardable);

  const forwardMessages = React.useCallback(() => {
    if (!canForwardMessages) {
      showToast({ toastType: ToastType.CannotForwardEmptyMessage });
      return;
    }
    const conversationIds = selectedContacts.map(contact => contact.id);
    if (lonelyDraft != null) {
      // Add link preview only if it is not currently loading.
      const previews = lonelyLinkPreview?.domain ? [lonelyLinkPreview] : [];
      doForwardMessages(conversationIds, [{ ...lonelyDraft, previews }]);
    } else {
      doForwardMessages(
        conversationIds,
        drafts.map(draft => {
          // We don't keep @mention bodyRanges in multi-forward scenarios
          const result = applyRangesToText(
            {
              body: draft.messageBody ?? '',
              bodyRanges: draft.bodyRanges ?? [],
            },
            {
              replaceMentions: true,
              replaceSpoilers: false,
            }
          );

          return {
            ...draft,
            messageBody: result.body,
            bodyRanges: result.bodyRanges,
          };
        })
      );
    }
  }, [
    drafts,
    lonelyDraft,
    lonelyLinkPreview,
    doForwardMessages,
    selectedContacts,
    canForwardMessages,
    showToast,
  ]);

  const normalizedSearchTerm = searchTerm.trim();
  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilteredConversations(
        filterAndSortConversations(
          candidateConversations,
          normalizedSearchTerm,
          regionCode
        )
      );
    }, 200);
    return () => {
      clearTimeout(timeout);
    };
  }, [
    candidateConversations,
    normalizedSearchTerm,
    setFilteredConversations,
    regionCode,
  ]);

  const contactLookup = useMemo(() => {
    const map = new Map();
    candidateConversations.forEach(contact => {
      map.set(contact.id, contact);
    });
    return map;
  }, [candidateConversations]);

  const toggleSelectedConversation = useCallback(
    (conversationId: string) => {
      let removeContact = false;
      const nextSelectedContacts = selectedContacts.filter(contact => {
        if (contact.id === conversationId) {
          removeContact = true;
          return false;
        }
        return true;
      });
      if (removeContact) {
        setSelectedContacts(nextSelectedContacts);
        return;
      }
      const selectedContact = contactLookup.get(conversationId);
      if (selectedContact) {
        if (selectedContact.announcementsOnly && !selectedContact.areWeAdmin) {
          setCannotMessage(true);
        } else {
          setSelectedContacts([...nextSelectedContacts, selectedContact]);
        }
      }
    },
    [contactLookup, selectedContacts, setSelectedContacts]
  );

  const handleBackOrClose = useCallback(() => {
    if (isEditingMessage) {
      setIsEditingMessage(false);
    } else {
      onClose();
    }
  }, [isEditingMessage, onClose, setIsEditingMessage]);

  const rowCount = filteredConversations.length;
  const getRow = (index: number): undefined | Row => {
    const contact = filteredConversations[index];
    if (!contact) {
      return undefined;
    }

    const isSelected = selectedConversationIdsSet.has(contact.id);

    let disabledReason: undefined | ContactCheckboxDisabledReason;
    if (hasSelectedMaximumNumberOfContacts && !isSelected) {
      disabledReason = ContactCheckboxDisabledReason.MaximumContactsSelected;
    }

    return {
      type: RowType.ContactCheckbox,
      contact,
      isChecked: isSelected,
      disabledReason,
    };
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    return () => {
      clearTimeout(timeout);
    };
  }, []);

  const footer = (
    <div className="module-ForwardMessageModal__footer">
      <div>
        {selectedContacts.map((contact, index) => {
          return (
            <Fragment key={contact.id}>
              <UserText text={contact.title} />
              {index < selectedContacts.length - 1 ? ', ' : ''}
            </Fragment>
          );
        })}
      </div>
      <div>
        {isEditingMessage || !isLonelyDraftEditable ? (
          <Button
            aria-label={i18n('icu:ForwardMessageModal--continue')}
            className="module-ForwardMessageModal__send-button module-ForwardMessageModal__send-button--forward"
            aria-disabled={!canForwardMessages}
            onClick={forwardMessages}
          />
        ) : (
          <Button
            aria-label={i18n('icu:forwardMessage')}
            className="module-ForwardMessageModal__send-button module-ForwardMessageModal__send-button--continue"
            disabled={!hasContactsSelected}
            onClick={() => setIsEditingMessage(true)}
          />
        )}
      </div>
    </div>
  );

  let title: string;
  if (type === ForwardMessagesModalType.Forward) {
    title = i18n('icu:ForwardMessageModal__title');
  } else if (type === ForwardMessagesModalType.ShareCallLink) {
    title = i18n('icu:ForwardMessageModal__ShareCallLink');
  } else {
    throw missingCaseError(type);
  }

  const modalTheme = isInFullScreenCall ? Theme.Dark : undefined;

  return (
    <>
      {cannotMessage && (
        <ConfirmationDialog
          dialogName="ForwardMessageModal.confirm"
          cancelText={i18n('icu:Confirmation--confirm')}
          i18n={i18n}
          onClose={() => setCannotMessage(false)}
        >
          {i18n('icu:GroupV2--cannot-send')}
        </ConfirmationDialog>
      )}
      <Modal
        modalName="ForwardMessageModal"
        hasXButton
        i18n={i18n}
        onClose={onClose}
        onBackButtonClick={isEditingMessage ? handleBackOrClose : undefined}
        moduleClassName="module-ForwardMessageModal"
        title={title}
        theme={modalTheme}
        padded={false}
        modalFooter={footer}
        noMouseClose
      >
        {isEditingMessage && lonelyDraft != null ? (
          <ForwardMessageEditor
            draft={lonelyDraft}
            linkPreview={lonelyLinkPreview}
            onChange={(messageBody, bodyRanges) => {
              onChange([{ ...lonelyDraft, messageBody, bodyRanges }]);
            }}
            onChangeAttachments={attachments => {
              onChange([{ ...lonelyDraft, attachments }]);
            }}
            removeLinkPreview={removeLinkPreview}
            theme={theme}
            i18n={i18n}
            RenderCompositionTextArea={RenderCompositionTextArea}
            onSubmit={forwardMessages}
          />
        ) : (
          <div className="module-ForwardMessageModal__main-body">
            <SearchInput
              disabled={candidateConversations.length === 0}
              i18n={i18n}
              placeholder={i18n('icu:contactSearchPlaceholder')}
              onChange={event => {
                setSearchTerm(event.target.value);
              }}
              ref={inputRef}
              value={searchTerm}
            />
            {candidateConversations.length ? (
              <SizeObserver>
                {(ref, size) => (
                  <div
                    className="module-ForwardMessageModal__list-wrapper"
                    ref={ref}
                  >
                    <ConversationList
                      dimensions={size ?? undefined}
                      getPreferredBadge={getPreferredBadge}
                      getRow={getRow}
                      i18n={i18n}
                      onClickArchiveButton={shouldNeverBeCalled}
                      onClickContactCheckbox={(
                        conversationId: string,
                        disabledReason:
                          | undefined
                          | ContactCheckboxDisabledReason
                      ) => {
                        if (
                          disabledReason !==
                          ContactCheckboxDisabledReason.MaximumContactsSelected
                        ) {
                          toggleSelectedConversation(conversationId);
                        }
                      }}
                      lookupConversationWithoutServiceId={
                        asyncShouldNeverBeCalled
                      }
                      showConversation={shouldNeverBeCalled}
                      showUserNotFoundModal={shouldNeverBeCalled}
                      setIsFetchingUUID={shouldNeverBeCalled}
                      onClickClearFilterButton={shouldNeverBeCalled}
                      onPreloadConversation={shouldNeverBeCalled}
                      onSelectConversation={shouldNeverBeCalled}
                      blockConversation={shouldNeverBeCalled}
                      removeConversation={shouldNeverBeCalled}
                      onOutgoingAudioCallInConversation={shouldNeverBeCalled}
                      onOutgoingVideoCallInConversation={shouldNeverBeCalled}
                      renderMessageSearchResult={() => {
                        shouldNeverBeCalled();
                        return <div />;
                      }}
                      rowCount={rowCount}
                      shouldRecomputeRowHeights={false}
                      showChooseGroupMembers={shouldNeverBeCalled}
                      showFindByUsername={shouldNeverBeCalled}
                      showFindByPhoneNumber={shouldNeverBeCalled}
                      theme={theme}
                    />
                  </div>
                )}
              </SizeObserver>
            ) : (
              <div className="module-ForwardMessageModal__no-candidate-contacts">
                {i18n('icu:noContactsFound')}
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

type ForwardMessageEditorProps = Readonly<{
  draft: MessageForwardDraft;
  linkPreview: LinkPreviewForUIType | null | void;
  removeLinkPreview(): void;
  RenderCompositionTextArea: ComponentType<SmartCompositionTextAreaProps>;
  onChange: (
    messageText: string,
    bodyRanges: HydratedBodyRangesType,
    caretLocation?: number
  ) => unknown;
  onChangeAttachments: (
    attachments: ReadonlyArray<AttachmentForUIType>
  ) => unknown;
  onSubmit: () => unknown;
  theme: ThemeType;
  i18n: LocalizerType;
}>;

function ForwardMessageEditor({
  draft,
  linkPreview,
  i18n,
  RenderCompositionTextArea,
  removeLinkPreview,
  onChange,
  onChangeAttachments,
  onSubmit,
  theme,
}: ForwardMessageEditorProps): JSX.Element {
  const { attachments } = draft;
  return (
    <div className="module-ForwardMessageModal__main-body">
      {linkPreview ? (
        <div className="module-ForwardMessageModal--link-preview">
          <StagedLinkPreview
            date={linkPreview.date}
            description={linkPreview.description ?? ''}
            domain={linkPreview.domain}
            i18n={i18n}
            image={linkPreview.image}
            onClose={removeLinkPreview}
            title={linkPreview.title}
            url={linkPreview.url}
            isCallLink={linkPreview.isCallLink}
          />
        </div>
      ) : null}
      {attachments != null && attachments.length > 0 ? (
        <AttachmentList
          attachments={attachments}
          i18n={i18n}
          onCloseAttachment={attachment => {
            const newAttachments = attachments.filter(
              currentAttachment => currentAttachment !== attachment
            );
            onChangeAttachments(newAttachments);
          }}
        />
      ) : null}

      <RenderCompositionTextArea
        bodyRanges={draft.bodyRanges ?? null}
        draftText={draft.messageBody ?? ''}
        isActive
        onChange={onChange}
        onSubmit={onSubmit}
        theme={theme}
        emojiSkinToneDefault={EmojiSkinTone.None}
      />
    </div>
  );
}

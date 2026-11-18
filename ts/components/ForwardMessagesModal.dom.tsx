// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ComponentType, JSX } from 'react';
import { useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import classNames from 'classnames';
import { AttachmentList } from './conversation/AttachmentList.dom.tsx';
import type { AttachmentForUIType } from '../types/Attachment.std.ts';
import { ContactCheckboxDisabledReason } from './conversationList/ContactCheckbox.dom.tsx';
import type { Row } from './ConversationList.dom.tsx';
import { ConversationList, RowType } from './ConversationList.dom.tsx';
import type { ConversationType } from '../state/ducks/conversations.preload.ts';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges.preload.ts';
import type { LocalizerType, ThemeType } from '../types/Util.std.ts';
import type { SmartCompositionTextAreaProps } from '../state/smart/CompositionTextArea.preload.tsx';
import { StagedLinkPreview } from './conversation/StagedLinkPreview.dom.tsx';
import { filterAndSortConversations } from '../util/filterAndSortConversations.std.ts';
import {
  shouldNeverBeCalled,
  asyncShouldNeverBeCalled,
} from '../util/shouldNeverBeCalled.std.ts';
import type { LinkPreviewForUIType } from '../types/message/LinkPreviews.std.ts';
import { ToastType } from '../types/Toast.std.ts';
import type { ShowToastAction } from '../state/ducks/toast.dom.ts';
import type { HydratedBodyRangesType } from '../types/BodyRange.std.ts';
import { UserText } from './UserText.dom.tsx';
import { AxoDialog } from '../axo/dialogs/AxoDialog.dom.tsx';
import { AxoSearchField } from '../axo/fields/AxoSearchField.dom.tsx';
import { AxoTheme } from '../axo/AxoTheme.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';
import { SizeObserver } from '../hooks/useSizeObserver.dom.tsx';
import {
  isDraftEditable,
  isDraftForwardable,
  type MessageForwardDraft,
} from '../types/ForwardDraft.std.ts';
import { missingCaseError } from '../util/missingCaseError.std.ts';
import { Theme, themeClassName } from '../util/theme.std.ts';
import { Emoji } from '../axo/emoji.std.ts';
import { AxoConfirmDialog } from '../axo/dialogs/AxoConfirmDialog.dom.tsx';

export enum ForwardMessagesModalType {
  Forward,
  ForwardAttachment,
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

  linkPreview: LinkPreviewForUIType | void;
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
  linkPreview,
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
  const lonelyLinkPreview = isLonelyDraft ? linkPreview : null;

  const hasSelectedMaximumNumberOfContacts =
    selectedContacts.length >= MAX_FORWARD;

  const selectedConversationIdsSet: Set<string> = useMemo(
    () => new Set(selectedContacts.map(contact => contact.id)),
    [selectedContacts]
  );

  const hasContactsSelected = Boolean(selectedContacts.length);

  const canForwardMessages =
    hasContactsSelected && drafts.every(isDraftForwardable);

  const forwardMessages = useCallback(() => {
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
      doForwardMessages(conversationIds, drafts);
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

  const selectedContactNames = selectedContacts.map((contact, index) => {
    return (
      <Fragment key={contact.id}>
        <UserText text={contact.title} />
        {index < selectedContacts.length - 1 ? ', ' : ''}
      </Fragment>
    );
  });

  let title: string;
  if (
    type === ForwardMessagesModalType.Forward ||
    type === ForwardMessagesModalType.ForwardAttachment
  ) {
    title = i18n('icu:ForwardMessageModal__title');
  } else if (type === ForwardMessagesModalType.ShareCallLink) {
    title = i18n('icu:ForwardMessageModal__ShareCallLink');
  } else {
    throw missingCaseError(type);
  }

  // Legacy children (ConversationList, the composer) need a `.dark-theme`
  // ancestor; AxoTheme.Override only covers Axo parts
  const legacyThemeClassName = isInFullScreenCall
    ? themeClassName(Theme.Dark)
    : undefined;

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        onClose();
      }
    },
    [onClose]
  );

  return (
    <>
      <AxoConfirmDialog.Root
        open={cannotMessage}
        onOpenChange={setCannotMessage}
        // @ts-expect-error ConfirmationDialog migration: Needs title
        title={null}
        description={i18n('icu:GroupV2--cannot-send')}
      >
        <AxoConfirmDialog.Ok />
      </AxoConfirmDialog.Root>
      <AxoTheme.Override theme={isInFullScreenCall ? 'force-dark' : 'auto'}>
        <AxoDialog.Root open onOpenChange={handleOpenChange}>
          <AxoDialog.Content
            size="md"
            escape={
              hasContactsSelected || isEditingMessage
                ? 'cancel-is-destructive'
                : 'cancel-is-noop'
            }
          >
            <AxoDialog.Header>
              {isEditingMessage && (
                <AxoDialog.Back onClick={handleBackOrClose} />
              )}
              <AxoDialog.Title>{title}</AxoDialog.Title>
              <AxoDialog.Close />
            </AxoDialog.Header>
            {!isEditingMessage && (
              <AxoDialog.Search>
                <AxoSearchField.Root
                  value={searchTerm}
                  onValueChange={setSearchTerm}
                  disabled={candidateConversations.length === 0}
                >
                  <AxoSearchField.Icon />
                  <AxoSearchField.Input
                    placeholder={i18n('icu:contactSearchPlaceholder')}
                    autoFocus
                  />
                  <AxoSearchField.Clear />
                </AxoSearchField.Root>
              </AxoDialog.Search>
            )}
            <AxoDialog.Body
              scrollbarWidth="none"
              // The list and the composer have their own scroll containers
              padding="deprecated-only-scrollbar-gutter"
            >
              <div
                className={classNames(
                  'module-ForwardMessageModal',
                  legacyThemeClassName,
                  tw('flex h-90 flex-col')
                )}
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
                  <>
                    {candidateConversations.length ? (
                      <SizeObserver>
                        {(ref, size) => (
                          <div
                            className="module-ForwardMessageModal__list-wrapper"
                            ref={ref}
                          >
                            <ConversationList
                              dimensions={
                                size?.hidden === false ? size : undefined
                              }
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
                              onOutgoingAudioCallInConversation={
                                shouldNeverBeCalled
                              }
                              onOutgoingVideoCallInConversation={
                                shouldNeverBeCalled
                              }
                              renderMessageSearchResult={() => {
                                shouldNeverBeCalled();
                                return <div />;
                              }}
                              rowCount={rowCount}
                              shouldRecomputeRowHeights={false}
                              resetShouldRecomputeRowHeights={
                                shouldNeverBeCalled
                              }
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
                  </>
                )}
              </div>
            </AxoDialog.Body>
            <AxoDialog.Footer>
              <AxoDialog.FooterContent>
                <span className={legacyThemeClassName}>
                  {selectedContactNames}
                </span>
              </AxoDialog.FooterContent>
              <AxoDialog.Actions>
                {isEditingMessage || !isLonelyDraftEditable ? (
                  <AxoDialog.IconAction
                    variant="strong-primary"
                    symbol="send-fill"
                    label={i18n('icu:ForwardMessageModal--continue')}
                    disabled={!canForwardMessages}
                    onClick={forwardMessages}
                  />
                ) : (
                  <AxoDialog.IconAction
                    variant="strong-primary"
                    symbol="arrow-[end]"
                    label={i18n('icu:forwardMessage')}
                    disabled={!hasContactsSelected}
                    onClick={() => setIsEditingMessage(true)}
                  />
                )}
              </AxoDialog.Actions>
            </AxoDialog.Footer>
          </AxoDialog.Content>
        </AxoDialog.Root>
      </AxoTheme.Override>
    </>
  );
}

type ForwardMessageEditorProps = Readonly<{
  draft: MessageForwardDraft;
  linkPreview: LinkPreviewForUIType | null | void;
  removeLinkPreview: () => void;
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
        emojiSkinToneDefault={Emoji.SkinTone.None}
      />
    </div>
  );
}

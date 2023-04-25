// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
} from 'react';
import type { MeasuredComponentProps } from 'react-measure';
import Measure from 'react-measure';
import { animated } from '@react-spring/web';

import classNames from 'classnames';
import { AttachmentList } from './conversation/AttachmentList';
import type { AttachmentType } from '../types/Attachment';
import { Button } from './Button';
import { ConfirmationDialog } from './ConfirmationDialog';
import { ContactCheckboxDisabledReason } from './conversationList/ContactCheckbox';
import type { Row } from './ConversationList';
import { ConversationList, RowType } from './ConversationList';
import type { ConversationType } from '../state/ducks/conversations';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import type { LocalizerType, ThemeType } from '../types/Util';
import type { SmartCompositionTextAreaProps } from '../state/smart/CompositionTextArea';
import { ModalHost } from './ModalHost';
import { SearchInput } from './SearchInput';
import { StagedLinkPreview } from './conversation/StagedLinkPreview';
import { filterAndSortConversationsByRecent } from '../util/filterAndSortConversations';
import { useAnimated } from '../hooks/useAnimated';
import {
  shouldNeverBeCalled,
  asyncShouldNeverBeCalled,
} from '../util/shouldNeverBeCalled';
import type { MessageForwardDraft } from '../util/maybeForwardMessages';
import {
  isDraftEditable,
  isDraftForwardable,
} from '../util/maybeForwardMessages';
import type { LinkPreviewType } from '../types/message/LinkPreviews';
import { LinkPreviewSourceType } from '../types/LinkPreview';
import { ToastType } from '../types/Toast';
import type { ShowToastAction } from '../state/ducks/toast';
import type { HydratedBodyRangesType } from '../types/BodyRange';
import { BodyRange } from '../types/BodyRange';
import { UserText } from './UserText';

export type DataPropsType = {
  candidateConversations: ReadonlyArray<ConversationType>;
  doForwardMessages: (
    conversationIds: ReadonlyArray<string>,
    drafts: ReadonlyArray<MessageForwardDraft>
  ) => void;
  drafts: ReadonlyArray<MessageForwardDraft>;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;

  linkPreviewForSource: (
    source: LinkPreviewSourceType
  ) => LinkPreviewType | void;
  onClose: () => void;
  onChange: (
    updatedDrafts: ReadonlyArray<MessageForwardDraft>,
    caretLocation?: number
  ) => unknown;
  regionCode: string | undefined;
  RenderCompositionTextArea: (
    props: SmartCompositionTextAreaProps
  ) => JSX.Element;
  showToast: ShowToastAction;
  theme: ThemeType;
};

type ActionPropsType = {
  removeLinkPreview: () => void;
};

export type PropsType = DataPropsType & ActionPropsType;

const MAX_FORWARD = 5;

export function ForwardMessagesModal({
  drafts,
  candidateConversations,
  doForwardMessages,
  linkPreviewForSource,
  getPreferredBadge,
  i18n,
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
    filterAndSortConversationsByRecent(candidateConversations, '', regionCode)
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
      const previews = lonelyLinkPreview ? [lonelyLinkPreview] : [];
      doForwardMessages(conversationIds, [{ ...lonelyDraft, previews }]);
    } else {
      doForwardMessages(
        conversationIds,
        drafts.map(draft => ({
          ...draft,
          // We don't keep @mention bodyRanges in multi-forward scenarios
          bodyRanges: draft.bodyRanges?.filter(BodyRange.isFormatting),
        }))
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
        filterAndSortConversationsByRecent(
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

  const { close, modalStyles, overlayStyles } = useAnimated(onClose, {
    getFrom: () => ({ opacity: 0, transform: 'translateY(48px)' }),
    getTo: isOpen =>
      isOpen
        ? { opacity: 1, transform: 'translateY(0px)' }
        : {
            opacity: 0,
            transform: 'translateY(48px)',
          },
  });

  const handleBackOrClose = useCallback(() => {
    if (isEditingMessage) {
      setIsEditingMessage(false);
    } else {
      close();
    }
  }, [isEditingMessage, close, setIsEditingMessage]);

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
      <ModalHost
        modalName="ForwardMessageModal"
        noMouseClose
        onEscape={handleBackOrClose}
        onClose={close}
        overlayStyles={overlayStyles}
        useFocusTrap={false}
      >
        <animated.div
          className="module-ForwardMessageModal"
          style={modalStyles}
        >
          <div
            className={classNames('module-ForwardMessageModal__header', {
              'module-ForwardMessageModal__header--edit': isEditingMessage,
            })}
          >
            {isEditingMessage ? (
              <button
                aria-label={i18n('icu:back')}
                className="module-ForwardMessageModal__header--back"
                onClick={() => setIsEditingMessage(false)}
                type="button"
              >
                &nbsp;
              </button>
            ) : (
              <button
                aria-label={i18n('icu:close')}
                className="module-ForwardMessageModal__header--close"
                onClick={close}
                type="button"
              />
            )}
            <h1>{i18n('icu:ForwardMessageModal__title')}</h1>
          </div>
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
                <Measure bounds>
                  {({ contentRect, measureRef }: MeasuredComponentProps) => (
                    <div
                      className="module-ForwardMessageModal__list-wrapper"
                      ref={measureRef}
                    >
                      <ConversationList
                        dimensions={contentRect.bounds}
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
                        lookupConversationWithoutUuid={asyncShouldNeverBeCalled}
                        showConversation={shouldNeverBeCalled}
                        showUserNotFoundModal={shouldNeverBeCalled}
                        setIsFetchingUUID={shouldNeverBeCalled}
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
                        theme={theme}
                      />
                    </div>
                  )}
                </Measure>
              ) : (
                <div className="module-ForwardMessageModal__no-candidate-contacts">
                  {i18n('icu:noContactsFound')}
                </div>
              )}
            </div>
          )}
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
        </animated.div>
      </ModalHost>
    </>
  );
}

type ForwardMessageEditorProps = Readonly<{
  draft: MessageForwardDraft;
  linkPreview: LinkPreviewType | null | void;
  removeLinkPreview(): void;
  RenderCompositionTextArea: (
    props: SmartCompositionTextAreaProps
  ) => JSX.Element;
  onChange: (
    messageText: string,
    bodyRanges: HydratedBodyRangesType,
    caretLocation?: number
  ) => unknown;
  onChangeAttachments: (attachments: ReadonlyArray<AttachmentType>) => unknown;
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
            domain={linkPreview.url}
            i18n={i18n}
            image={linkPreview.image}
            onClose={removeLinkPreview}
            title={linkPreview.title}
            url={linkPreview.url}
          />
        </div>
      ) : null}
      {attachments != null && attachments.length > 0 ? (
        <AttachmentList
          attachments={attachments}
          i18n={i18n}
          onCloseAttachment={(attachment: AttachmentType) => {
            const newAttachments = attachments.filter(
              currentAttachment => currentAttachment !== attachment
            );
            onChangeAttachments(newAttachments);
          }}
        />
      ) : null}

      <RenderCompositionTextArea
        bodyRanges={draft.bodyRanges}
        draftText={draft.messageBody ?? ''}
        onChange={onChange}
        onSubmit={onSubmit}
        theme={theme}
      />
    </div>
  );
}

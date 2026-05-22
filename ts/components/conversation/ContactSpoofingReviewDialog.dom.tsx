// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode, JSX } from 'react';
import { useState } from 'react';
import type { LocalizerType, ThemeType } from '../../types/Util.std.ts';
import type { ConversationType } from '../../state/ducks/conversations.preload.ts';
import type { PreferredBadgeSelectorType } from '../../state/selectors/badges.preload.ts';
import {
  MessageRequestActionsConfirmation,
  MessageRequestState,
} from './MessageRequestActionsConfirmation.dom.tsx';
import { ContactSpoofingType } from '../../util/contactSpoofing.std.ts';
import { RemoveGroupMemberConfirmationDialog } from './RemoveGroupMemberConfirmationDialog.dom.tsx';
import { ContactSpoofingReviewDialogPerson } from './ContactSpoofingReviewDialogPerson.dom.tsx';
import { assertDev } from '../../util/assert.std.ts';
import { missingCaseError } from '../../util/missingCaseError.std.ts';
import { isInSystemContacts } from '../../util/isInSystemContacts.std.ts';
import type { ContactModalStateType } from '../../types/globalModals.std.ts';
import { AxoDialog } from '../../axo/AxoDialog.dom.tsx';
import { tw } from '../../axo/tw.dom.tsx';
import { AxoButton } from '../../axo/AxoButton.dom.tsx';

export type ReviewPropsType = Readonly<
  | {
      type: ContactSpoofingType.DirectConversationWithSameTitle;
      possiblyUnsafe: {
        conversation: ConversationType;
        isSignalConnection: boolean;
        sharedGroupNames: ReadonlyArray<string>;
      };
      safe: {
        conversation: ConversationType;
        isSignalConnection: boolean;
        sharedGroupNames: ReadonlyArray<string>;
      };
    }
  | {
      type: ContactSpoofingType.MultipleGroupMembersWithSameTitle;
      group: ConversationType;
      collisionInfoByTitle: Record<
        string,
        Array<{
          oldName?: string;
          isSignalConnection: boolean;
          conversation: ConversationType;
          sharedGroupNames: ReadonlyArray<string>;
        }>
      >;
    }
>;

export type PropsType = {
  conversationId: string;
  acceptConversation: (conversationId: string) => void;
  reportSpam: (conversationId: string) => void;
  blockAndReportSpam: (conversationId: string) => void;
  blockConversation: (conversationId: string) => void;
  deleteConversation: (conversationId: string) => void;
  toggleSignalConnectionsModal: () => void;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  onClose: () => void;
  showContactModal: (payload: ContactModalStateType) => void;
  removeMember: (
    conversationId: string,
    memberConversationId: string
  ) => unknown;
  theme: ThemeType;
} & ReviewPropsType;

enum ConfirmationStateType {
  ConfirmingDelete,
  ConfirmingBlock,
  ConfirmingGroupRemoval,
}

export function ContactSpoofingReviewDialog(props: PropsType): JSX.Element {
  const {
    acceptConversation,
    reportSpam,
    blockAndReportSpam,
    blockConversation,
    conversationId,
    deleteConversation,
    toggleSignalConnectionsModal,
    getPreferredBadge,
    i18n,
    onClose,
    showContactModal,
    removeMember,
    theme,
  } = props;

  const [confirmationState, setConfirmationState] = useState<
    | undefined
    | {
        type: ConfirmationStateType.ConfirmingGroupRemoval;
        affectedConversation: ConversationType;
        group: ConversationType;
      }
    | {
        type:
          | ConfirmationStateType.ConfirmingDelete
          | ConfirmationStateType.ConfirmingBlock;
        affectedConversation: ConversationType;
      }
  >();

  if (confirmationState) {
    const { type, affectedConversation } = confirmationState;
    switch (type) {
      case ConfirmationStateType.ConfirmingDelete:
      case ConfirmationStateType.ConfirmingBlock:
        return (
          <MessageRequestActionsConfirmation
            addedByName={affectedConversation}
            conversationId={affectedConversation.id}
            conversationType={affectedConversation.type}
            conversationName={affectedConversation}
            i18n={i18n}
            isBlocked={affectedConversation.isBlocked ?? false}
            isReported={affectedConversation.isReported ?? false}
            state={
              type === ConfirmationStateType.ConfirmingDelete
                ? MessageRequestState.deleting
                : MessageRequestState.blocking
            }
            acceptConversation={acceptConversation}
            reportSpam={reportSpam}
            blockAndReportSpam={blockAndReportSpam}
            blockConversation={blockConversation}
            deleteConversation={deleteConversation}
            onChangeState={messageRequestState => {
              switch (messageRequestState) {
                case MessageRequestState.blocking:
                  setConfirmationState({
                    type: ConfirmationStateType.ConfirmingBlock,
                    affectedConversation,
                  });
                  break;
                case MessageRequestState.deleting:
                  setConfirmationState({
                    type: ConfirmationStateType.ConfirmingDelete,
                    affectedConversation,
                  });
                  break;
                case MessageRequestState.reportingAndMaybeBlocking:
                case MessageRequestState.acceptedOptions:
                case MessageRequestState.unblocking:
                case MessageRequestState.accepting:
                  assertDev(
                    false,
                    `Got unexpected MessageRequestState.${MessageRequestState[messageRequestState]} state. Clearing confiration state`
                  );
                  setConfirmationState(undefined);
                  break;
                case MessageRequestState.default:
                  setConfirmationState(undefined);
                  break;
                default:
                  throw missingCaseError(messageRequestState);
              }
            }}
          />
        );
      case ConfirmationStateType.ConfirmingGroupRemoval: {
        const { group } = confirmationState;
        return (
          <RemoveGroupMemberConfirmationDialog
            conversation={affectedConversation}
            group={group}
            i18n={i18n}
            onClose={() => {
              setConfirmationState(undefined);
            }}
            onRemove={() => {
              removeMember(conversationId, affectedConversation.id);
            }}
          />
        );
      }
      default:
        throw missingCaseError(type);
    }
  }

  let title: string;
  let contents: ReactNode;

  switch (props.type) {
    case ContactSpoofingType.DirectConversationWithSameTitle: {
      const { possiblyUnsafe, safe } = props;
      assertDev(
        possiblyUnsafe.conversation.type === 'direct',
        '<ContactSpoofingReviewDialog> expected a direct conversation for the "possibly unsafe" conversation'
      );
      assertDev(
        safe.conversation.type === 'direct',
        '<ContactSpoofingReviewDialog> expected a direct conversation for the "safe" conversation'
      );

      title = i18n('icu:ContactSpoofingReviewDialog__title');
      contents = (
        <>
          <div className={tw('mb-2.5 type-body-medium text-label-secondary')}>
            <AxoDialog.Description>
              {i18n('icu:ContactSpoofingReviewDialog__description')}
            </AxoDialog.Description>
          </div>
          <h2 className={tw('type-title-small text-label-primary')}>
            {i18n('icu:ContactSpoofingReviewDialog__possibly-unsafe-title')}
          </h2>
          <ContactSpoofingReviewDialogPerson
            conversation={possiblyUnsafe.conversation}
            getPreferredBadge={getPreferredBadge}
            toggleSignalConnectionsModal={toggleSignalConnectionsModal}
            sharedGroupNames={possiblyUnsafe.sharedGroupNames}
            i18n={i18n}
            theme={theme}
            isSignalConnection={possiblyUnsafe.isSignalConnection}
            oldName={undefined}
          >
            <div className={tw('flex gap-2')}>
              <AxoButton.Root
                size="md"
                variant="subtle-destructive"
                onClick={() => {
                  setConfirmationState({
                    type: ConfirmationStateType.ConfirmingDelete,
                    affectedConversation: possiblyUnsafe.conversation,
                  });
                }}
              >
                {i18n('icu:MessageRequests--delete')}
              </AxoButton.Root>
              <AxoButton.Root
                size="md"
                variant="subtle-destructive"
                onClick={() => {
                  setConfirmationState({
                    type: ConfirmationStateType.ConfirmingBlock,
                    affectedConversation: possiblyUnsafe.conversation,
                  });
                }}
              >
                {i18n('icu:MessageRequests--block')}
              </AxoButton.Root>
            </div>
          </ContactSpoofingReviewDialogPerson>
          <hr
            className={tw('my-2.5 border-0 border-t border-t-border-secondary')}
          />
          <h2 className={tw('type-title-small text-label-primary')}>
            {i18n('icu:ContactSpoofingReviewDialog__safe-title')}
          </h2>
          <ContactSpoofingReviewDialogPerson
            conversation={safe.conversation}
            getPreferredBadge={getPreferredBadge}
            toggleSignalConnectionsModal={toggleSignalConnectionsModal}
            sharedGroupNames={safe.sharedGroupNames}
            i18n={i18n}
            onClick={() => {
              showContactModal({ contactId: safe.conversation.id });
            }}
            theme={theme}
            isSignalConnection={safe.isSignalConnection}
            oldName={undefined}
          />
        </>
      );
      break;
    }
    case ContactSpoofingType.MultipleGroupMembersWithSameTitle: {
      const { group, collisionInfoByTitle } = props;
      const sharedTitles = Object.keys(collisionInfoByTitle);
      const numSharedTitles = sharedTitles.length;
      const totalConversations = Object.values(collisionInfoByTitle).reduce(
        (sum, conversationInfos) => sum + conversationInfos.length,
        0
      );

      title = i18n('icu:ContactSpoofingReviewDialog__group__title');
      contents = (
        <>
          <div className={tw('mb-2.5 type-body-medium text-label-secondary')}>
            <AxoDialog.Description>
              {numSharedTitles > 1
                ? i18n(
                    'icu:ContactSpoofingReviewDialog__group__multiple-conflicts__description',
                    {
                      count: numSharedTitles,
                    }
                  )
                : i18n('icu:ContactSpoofingReviewDialog__group__description', {
                    count: totalConversations,
                  })}
            </AxoDialog.Description>
          </div>

          {Object.values(collisionInfoByTitle)
            .map((conversationInfos, titleIdx) =>
              conversationInfos.map((conversationInfo, conversationIdx) => {
                let button: ReactNode;
                if (group.areWeAdmin) {
                  button = (
                    <AxoButton.Root
                      size="md"
                      variant="subtle-destructive"
                      onClick={() => {
                        setConfirmationState({
                          type: ConfirmationStateType.ConfirmingGroupRemoval,
                          affectedConversation: conversationInfo.conversation,
                          group,
                        });
                      }}
                    >
                      {i18n('icu:RemoveGroupMemberConfirmation__remove-button')}
                    </AxoButton.Root>
                  );
                } else if (conversationInfo.conversation.isBlocked) {
                  button = (
                    <AxoButton.Root
                      size="md"
                      variant="subtle-affirmative"
                      onClick={() => {
                        acceptConversation(conversationInfo.conversation.id);
                      }}
                    >
                      {i18n('icu:MessageRequests--unblock')}
                    </AxoButton.Root>
                  );
                } else if (!isInSystemContacts(conversationInfo.conversation)) {
                  button = (
                    <AxoButton.Root
                      size="md"
                      variant="subtle-destructive"
                      onClick={() => {
                        setConfirmationState({
                          type: ConfirmationStateType.ConfirmingBlock,
                          affectedConversation: conversationInfo.conversation,
                        });
                      }}
                    >
                      {i18n('icu:MessageRequests--block')}
                    </AxoButton.Root>
                  );
                }

                const { oldName, isSignalConnection } = conversationInfo;

                return (
                  <>
                    <ContactSpoofingReviewDialogPerson
                      key={conversationInfo.conversation.id}
                      conversation={conversationInfo.conversation}
                      toggleSignalConnectionsModal={
                        toggleSignalConnectionsModal
                      }
                      sharedGroupNames={conversationInfo.sharedGroupNames}
                      getPreferredBadge={getPreferredBadge}
                      i18n={i18n}
                      theme={theme}
                      oldName={oldName}
                      onClick={() => {
                        showContactModal({
                          contactId: conversationInfo.conversation.id,
                        });
                      }}
                      isSignalConnection={isSignalConnection}
                    >
                      {button && (
                        <div className="module-ContactSpoofingReviewDialog__buttons">
                          {button}
                        </div>
                      )}
                    </ContactSpoofingReviewDialogPerson>
                    {titleIdx < sharedTitles.length - 1 ||
                    conversationIdx < conversationInfos.length - 1 ? (
                      <hr
                        className={tw(
                          'my-2.5 border-0 border-t border-t-border-secondary'
                        )}
                      />
                    ) : null}
                  </>
                );
              })
            )
            .flat()}
        </>
      );
      break;
    }
    default:
      throw missingCaseError(props);
  }

  return (
    <AxoDialog.Root open onOpenChange={onClose}>
      <AxoDialog.Content size="md" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title>{title}</AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body>{contents}</AxoDialog.Body>
        <AxoDialog.Footer />
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

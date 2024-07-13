// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactChild, ReactNode } from 'react';
import React, { useState } from 'react';

import type { LocalizerType, ThemeType } from '../../types/Util';
import type { ConversationType } from '../../state/ducks/conversations';
import type { PreferredBadgeSelectorType } from '../../state/selectors/badges';
import {
  MessageRequestActionsConfirmation,
  MessageRequestState,
} from './MessageRequestActionsConfirmation';
import { ContactSpoofingType } from '../../util/contactSpoofing';

import { Modal } from '../Modal';
import { RemoveGroupMemberConfirmationDialog } from './RemoveGroupMemberConfirmationDialog';
import { ContactSpoofingReviewDialogPerson } from './ContactSpoofingReviewDialogPerson';
import { Button, ButtonVariant } from '../Button';
import { assertDev } from '../../util/assert';
import { missingCaseError } from '../../util/missingCaseError';
import { isInSystemContacts } from '../../util/isInSystemContacts';

export type ReviewPropsType = Readonly<
  | {
      type: ContactSpoofingType.DirectConversationWithSameTitle;
      possiblyUnsafe: {
        conversation: ConversationType;
        isSignalConnection: boolean;
      };
      safe: {
        conversation: ConversationType;
        isSignalConnection: boolean;
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
        }>
      >;
    }
>;

export type PropsType = {
  conversationId: string;
  acceptConversation: (conversationId: string) => unknown;
  reportSpam: (conversationId: string) => unknown;
  blockAndReportSpam: (conversationId: string) => unknown;
  blockConversation: (conversationId: string) => unknown;
  deleteConversation: (conversationId: string) => unknown;
  toggleSignalConnectionsModal: () => void;
  updateSharedGroups: (conversationId: string) => void;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  onClose: () => void;
  showContactModal: (contactId: string, conversationId?: string) => unknown;
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
    updateSharedGroups,
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
  let contents: ReactChild;

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
          <p>{i18n('icu:ContactSpoofingReviewDialog__description')}</p>
          <h2>
            {i18n('icu:ContactSpoofingReviewDialog__possibly-unsafe-title')}
          </h2>
          <ContactSpoofingReviewDialogPerson
            conversation={possiblyUnsafe.conversation}
            getPreferredBadge={getPreferredBadge}
            toggleSignalConnectionsModal={toggleSignalConnectionsModal}
            updateSharedGroups={updateSharedGroups}
            i18n={i18n}
            theme={theme}
            isSignalConnection={possiblyUnsafe.isSignalConnection}
            oldName={undefined}
          >
            <div className="module-ContactSpoofingReviewDialog__buttons">
              <Button
                variant={ButtonVariant.SecondaryDestructive}
                onClick={() => {
                  setConfirmationState({
                    type: ConfirmationStateType.ConfirmingDelete,
                    affectedConversation: possiblyUnsafe.conversation,
                  });
                }}
              >
                {i18n('icu:MessageRequests--delete')}
              </Button>
              <Button
                variant={ButtonVariant.SecondaryDestructive}
                onClick={() => {
                  setConfirmationState({
                    type: ConfirmationStateType.ConfirmingBlock,
                    affectedConversation: possiblyUnsafe.conversation,
                  });
                }}
              >
                {i18n('icu:MessageRequests--block')}
              </Button>
            </div>
          </ContactSpoofingReviewDialogPerson>
          <hr />
          <h2>{i18n('icu:ContactSpoofingReviewDialog__safe-title')}</h2>
          <ContactSpoofingReviewDialogPerson
            conversation={safe.conversation}
            getPreferredBadge={getPreferredBadge}
            toggleSignalConnectionsModal={toggleSignalConnectionsModal}
            updateSharedGroups={updateSharedGroups}
            i18n={i18n}
            onClick={() => {
              showContactModal(safe.conversation.id);
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
          <p className="module-ContactSpoofingReviewDialog__description">
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
          </p>

          {Object.values(collisionInfoByTitle)
            .map((conversationInfos, titleIdx) =>
              conversationInfos.map((conversationInfo, conversationIdx) => {
                let button: ReactNode;
                if (group.areWeAdmin) {
                  button = (
                    <Button
                      variant={ButtonVariant.SecondaryAffirmative}
                      onClick={() => {
                        setConfirmationState({
                          type: ConfirmationStateType.ConfirmingGroupRemoval,
                          affectedConversation: conversationInfo.conversation,
                          group,
                        });
                      }}
                    >
                      {i18n('icu:RemoveGroupMemberConfirmation__remove-button')}
                    </Button>
                  );
                } else if (conversationInfo.conversation.isBlocked) {
                  button = (
                    <Button
                      variant={ButtonVariant.SecondaryAffirmative}
                      onClick={() => {
                        acceptConversation(conversationInfo.conversation.id);
                      }}
                    >
                      {i18n('icu:MessageRequests--unblock')}
                    </Button>
                  );
                } else if (!isInSystemContacts(conversationInfo.conversation)) {
                  button = (
                    <Button
                      variant={ButtonVariant.SecondaryDestructive}
                      onClick={() => {
                        setConfirmationState({
                          type: ConfirmationStateType.ConfirmingBlock,
                          affectedConversation: conversationInfo.conversation,
                        });
                      }}
                    >
                      {i18n('icu:MessageRequests--block')}
                    </Button>
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
                      updateSharedGroups={updateSharedGroups}
                      getPreferredBadge={getPreferredBadge}
                      i18n={i18n}
                      theme={theme}
                      oldName={oldName}
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
                      <hr />
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
    <Modal
      modalName="ContactSpoofingReviewDialog"
      hasXButton
      i18n={i18n}
      moduleClassName="module-ContactSpoofingReviewDialog"
      onClose={onClose}
      title={title}
    >
      {contents}
    </Modal>
  );
}

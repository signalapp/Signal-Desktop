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
import { Intl } from '../Intl';
import { assertDev } from '../../util/assert';
import { missingCaseError } from '../../util/missingCaseError';
import { isInSystemContacts } from '../../util/isInSystemContacts';
import { UserText } from '../UserText';

export type PropsType = {
  conversationId: string;
  acceptConversation: (conversationId: string) => unknown;
  blockAndReportSpam: (conversationId: string) => unknown;
  blockConversation: (conversationId: string) => unknown;
  deleteConversation: (conversationId: string) => unknown;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  onClose: () => void;
  showContactModal: (contactId: string, conversationId?: string) => unknown;
  removeMember: (
    conversationId: string,
    memberConversationId: string
  ) => unknown;
  theme: ThemeType;
} & (
  | {
      type: ContactSpoofingType.DirectConversationWithSameTitle;
      possiblyUnsafeConversation: ConversationType;
      safeConversation: ConversationType;
    }
  | {
      type: ContactSpoofingType.MultipleGroupMembersWithSameTitle;
      group: ConversationType;
      collisionInfoByTitle: Record<
        string,
        Array<{
          oldName?: string;
          conversation: ConversationType;
        }>
      >;
    }
);

enum ConfirmationStateType {
  ConfirmingDelete,
  ConfirmingBlock,
  ConfirmingGroupRemoval,
}

export function ContactSpoofingReviewDialog(props: PropsType): JSX.Element {
  const {
    acceptConversation,
    blockAndReportSpam,
    blockConversation,
    conversationId,
    deleteConversation,
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
            acceptConversation={acceptConversation}
            blockAndReportSpam={blockAndReportSpam}
            blockConversation={blockConversation}
            conversationId={affectedConversation.id}
            conversationType="direct"
            deleteConversation={deleteConversation}
            i18n={i18n}
            title={affectedConversation.title}
            state={
              type === ConfirmationStateType.ConfirmingDelete
                ? MessageRequestState.deleting
                : MessageRequestState.blocking
            }
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
                case MessageRequestState.unblocking:
                  assertDev(
                    false,
                    'Got unexpected MessageRequestState.unblocking state. Clearing confiration state'
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
      const { possiblyUnsafeConversation, safeConversation } = props;
      assertDev(
        possiblyUnsafeConversation.type === 'direct',
        '<ContactSpoofingReviewDialog> expected a direct conversation for the "possibly unsafe" conversation'
      );
      assertDev(
        safeConversation.type === 'direct',
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
            conversation={possiblyUnsafeConversation}
            getPreferredBadge={getPreferredBadge}
            i18n={i18n}
            theme={theme}
          >
            <div className="module-ContactSpoofingReviewDialog__buttons">
              <Button
                variant={ButtonVariant.SecondaryDestructive}
                onClick={() => {
                  setConfirmationState({
                    type: ConfirmationStateType.ConfirmingDelete,
                    affectedConversation: possiblyUnsafeConversation,
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
                    affectedConversation: possiblyUnsafeConversation,
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
            conversation={safeConversation}
            getPreferredBadge={getPreferredBadge}
            i18n={i18n}
            onClick={() => {
              showContactModal(safeConversation.id);
            }}
            theme={theme}
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

          {Object.values(collisionInfoByTitle).map(
            (conversationInfos, titleIdx) => {
              return (
                <>
                  <h2>
                    {i18n(
                      'icu:ContactSpoofingReviewDialog__group__members-header'
                    )}
                  </h2>
                  {conversationInfos.map(
                    (conversationInfo, conversationIdx) => {
                      let button: ReactNode;
                      if (group.areWeAdmin) {
                        button = (
                          <Button
                            variant={ButtonVariant.SecondaryAffirmative}
                            onClick={() => {
                              setConfirmationState({
                                type: ConfirmationStateType.ConfirmingGroupRemoval,
                                affectedConversation:
                                  conversationInfo.conversation,
                                group,
                              });
                            }}
                          >
                            {i18n(
                              'icu:RemoveGroupMemberConfirmation__remove-button'
                            )}
                          </Button>
                        );
                      } else if (conversationInfo.conversation.isBlocked) {
                        button = (
                          <Button
                            variant={ButtonVariant.SecondaryAffirmative}
                            onClick={() => {
                              acceptConversation(
                                conversationInfo.conversation.id
                              );
                            }}
                          >
                            {i18n('icu:MessageRequests--unblock')}
                          </Button>
                        );
                      } else if (
                        !isInSystemContacts(conversationInfo.conversation)
                      ) {
                        button = (
                          <Button
                            variant={ButtonVariant.SecondaryDestructive}
                            onClick={() => {
                              setConfirmationState({
                                type: ConfirmationStateType.ConfirmingBlock,
                                affectedConversation:
                                  conversationInfo.conversation,
                              });
                            }}
                          >
                            {i18n('icu:MessageRequests--block')}
                          </Button>
                        );
                      }

                      const { oldName } = conversationInfo;
                      const newName =
                        conversationInfo.conversation.profileName ||
                        conversationInfo.conversation.title;

                      let callout: JSX.Element | undefined;
                      if (oldName && oldName !== newName) {
                        callout = (
                          <div className="module-ContactSpoofingReviewDialogPerson__info__property module-ContactSpoofingReviewDialogPerson__info__property--callout">
                            <Intl
                              i18n={i18n}
                              id="icu:ContactSpoofingReviewDialog__group__name-change-info"
                              components={{
                                oldName: <UserText text={oldName} />,
                                newName: <UserText text={newName} />,
                              }}
                            />
                          </div>
                        );
                      }

                      return (
                        <>
                          <ContactSpoofingReviewDialogPerson
                            key={conversationInfo.conversation.id}
                            conversation={conversationInfo.conversation}
                            getPreferredBadge={getPreferredBadge}
                            i18n={i18n}
                            theme={theme}
                          >
                            {callout}
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
                    }
                  )}
                </>
              );
            }
          )}
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

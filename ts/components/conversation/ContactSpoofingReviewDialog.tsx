// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, {
  FunctionComponent,
  ReactChild,
  ReactNode,
  useState,
} from 'react';
import { concat, orderBy } from 'lodash';

import { LocalizerType } from '../../types/Util';
import { ConversationType } from '../../state/ducks/conversations';
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
import { Emojify } from './Emojify';
import { assert } from '../../util/assert';
import { missingCaseError } from '../../util/missingCaseError';
import { isInSystemContacts } from '../../util/isInSystemContacts';

type PropsType = {
  i18n: LocalizerType;
  onBlock: (conversationId: string) => unknown;
  onBlockAndReportSpam: (conversationId: string) => unknown;
  onClose: () => void;
  onDelete: (conversationId: string) => unknown;
  onShowContactModal: (contactId: string) => unknown;
  onUnblock: (conversationId: string) => unknown;
  removeMember: (conversationId: string) => unknown;
} & (
  | {
      type: ContactSpoofingType.DirectConversationWithSameTitle;
      possiblyUnsafeConversation: ConversationType;
      safeConversation: ConversationType;
    }
  | {
      type: ContactSpoofingType.MultipleGroupMembersWithSameTitle;
      areWeAdmin: boolean;
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

export const ContactSpoofingReviewDialog: FunctionComponent<PropsType> = props => {
  const {
    i18n,
    onBlock,
    onBlockAndReportSpam,
    onClose,
    onDelete,
    onShowContactModal,
    onUnblock,
    removeMember,
  } = props;

  const [confirmationState, setConfirmationState] = useState<
    | undefined
    | {
        type: ConfirmationStateType;
        affectedConversation: ConversationType;
      }
  >();

  if (confirmationState) {
    const { affectedConversation, type } = confirmationState;
    switch (type) {
      case ConfirmationStateType.ConfirmingDelete:
      case ConfirmationStateType.ConfirmingBlock:
        return (
          <MessageRequestActionsConfirmation
            i18n={i18n}
            onBlock={() => {
              onBlock(affectedConversation.id);
            }}
            onBlockAndReportSpam={() => {
              onBlockAndReportSpam(affectedConversation.id);
            }}
            onUnblock={() => {
              onUnblock(affectedConversation.id);
            }}
            onDelete={() => {
              onDelete(affectedConversation.id);
            }}
            name={affectedConversation.name}
            profileName={affectedConversation.profileName}
            phoneNumber={affectedConversation.phoneNumber}
            title={affectedConversation.title}
            conversationType="direct"
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
                  assert(
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
      case ConfirmationStateType.ConfirmingGroupRemoval:
        return (
          <RemoveGroupMemberConfirmationDialog
            conversation={affectedConversation}
            i18n={i18n}
            onClose={() => {
              setConfirmationState(undefined);
            }}
            onRemove={() => {
              removeMember(affectedConversation.id);
            }}
          />
        );
      default:
        throw missingCaseError(type);
    }
  }

  let title: string;
  let contents: ReactChild;

  switch (props.type) {
    case ContactSpoofingType.DirectConversationWithSameTitle: {
      const { possiblyUnsafeConversation, safeConversation } = props;
      assert(
        possiblyUnsafeConversation.type === 'direct',
        '<ContactSpoofingReviewDialog> expected a direct conversation for the "possibly unsafe" conversation'
      );
      assert(
        safeConversation.type === 'direct',
        '<ContactSpoofingReviewDialog> expected a direct conversation for the "safe" conversation'
      );

      title = i18n('ContactSpoofingReviewDialog__title');
      contents = (
        <>
          <p>{i18n('ContactSpoofingReviewDialog__description')}</p>
          <h2>{i18n('ContactSpoofingReviewDialog__possibly-unsafe-title')}</h2>
          <ContactSpoofingReviewDialogPerson
            conversation={possiblyUnsafeConversation}
            i18n={i18n}
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
                {i18n('MessageRequests--delete')}
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
                {i18n('MessageRequests--block')}
              </Button>
            </div>
          </ContactSpoofingReviewDialogPerson>
          <hr />
          <h2>{i18n('ContactSpoofingReviewDialog__safe-title')}</h2>
          <ContactSpoofingReviewDialogPerson
            conversation={safeConversation}
            i18n={i18n}
            onClick={() => {
              onShowContactModal(safeConversation.id);
            }}
          />
        </>
      );
      break;
    }
    case ContactSpoofingType.MultipleGroupMembersWithSameTitle: {
      const { areWeAdmin, collisionInfoByTitle } = props;

      const unsortedConversationInfos = concat(
        // This empty array exists to appease Lodash's type definitions.
        [],
        ...Object.values(collisionInfoByTitle)
      );
      const conversationInfos = orderBy(unsortedConversationInfos, [
        // We normally use an `Intl.Collator` to sort by title. We do this instead, as we
        //   only really care about stability (not perfect ordering).
        'title',
        'id',
      ]);

      title = i18n('ContactSpoofingReviewDialog__group__title');
      contents = (
        <>
          <p>
            {i18n('ContactSpoofingReviewDialog__group__description', [
              conversationInfos.length.toString(),
            ])}
          </p>
          <h2>{i18n('ContactSpoofingReviewDialog__group__members-header')}</h2>
          {conversationInfos.map((conversationInfo, index) => {
            let button: ReactNode;
            if (areWeAdmin) {
              button = (
                <Button
                  variant={ButtonVariant.SecondaryAffirmative}
                  onClick={() => {
                    setConfirmationState({
                      type: ConfirmationStateType.ConfirmingGroupRemoval,
                      affectedConversation: conversationInfo.conversation,
                    });
                  }}
                >
                  {i18n('RemoveGroupMemberConfirmation__remove-button')}
                </Button>
              );
            } else if (conversationInfo.conversation.isBlocked) {
              button = (
                <Button
                  variant={ButtonVariant.SecondaryAffirmative}
                  onClick={() => {
                    onUnblock(conversationInfo.conversation.id);
                  }}
                >
                  {i18n('MessageRequests--unblock')}
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
                  {i18n('MessageRequests--block')}
                </Button>
              );
            }

            const { oldName } = conversationInfo;
            const newName =
              conversationInfo.conversation.profileName ||
              conversationInfo.conversation.title;

            return (
              <>
                {index !== 0 && <hr />}
                <ContactSpoofingReviewDialogPerson
                  key={conversationInfo.conversation.id}
                  conversation={conversationInfo.conversation}
                  i18n={i18n}
                >
                  {Boolean(oldName) && oldName !== newName && (
                    <div className="module-ContactSpoofingReviewDialogPerson__info__property module-ContactSpoofingReviewDialogPerson__info__property--callout">
                      <Intl
                        i18n={i18n}
                        id="ContactSpoofingReviewDialog__group__name-change-info"
                        components={{
                          oldName: <Emojify text={oldName} />,
                          newName: <Emojify text={newName} />,
                        }}
                      />
                    </div>
                  )}
                  {button && (
                    <div className="module-ContactSpoofingReviewDialog__buttons">
                      {button}
                    </div>
                  )}
                </ContactSpoofingReviewDialogPerson>
              </>
            );
          })}
        </>
      );
      break;
    }
    default:
      throw missingCaseError(props);
  }

  return (
    <Modal
      hasXButton
      i18n={i18n}
      moduleClassName="module-ContactSpoofingReviewDialog"
      onClose={onClose}
      title={title}
    >
      {contents}
    </Modal>
  );
};

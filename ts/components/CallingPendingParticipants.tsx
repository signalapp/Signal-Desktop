// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable react/no-array-index-key */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { noop } from 'lodash';
import { Avatar, AvatarSize } from './Avatar';
import { ContactName } from './conversation/ContactName';
import { InContactsIcon } from './InContactsIcon';
import type { LocalizerType } from '../types/Util';
import type { ConversationType } from '../state/ducks/conversations';
import { isInSystemContacts } from '../util/isInSystemContacts';
import type {
  BatchUserActionPayloadType,
  PendingUserActionPayloadType,
} from '../state/ducks/calling';
import { Button, ButtonVariant } from './Button';
import type { ServiceIdString } from '../types/ServiceId';
import { handleOutsideClick } from '../util/handleOutsideClick';
import { Theme } from '../util/theme';
import { ConfirmationDialog } from './ConfirmationDialog';

enum ConfirmDialogState {
  None = 'None',
  ApproveAll = 'ApproveAll',
  DenyAll = 'DenyAll',
}

export type PropsType = {
  readonly i18n: LocalizerType;
  readonly participants: Array<ConversationType>;
  // For storybook
  readonly defaultIsExpanded?: boolean;
  readonly approveUser: (payload: PendingUserActionPayloadType) => void;
  readonly batchUserAction: (payload: BatchUserActionPayloadType) => void;
  readonly denyUser: (payload: PendingUserActionPayloadType) => void;
  readonly toggleCallLinkPendingParticipantModal: (
    conversationId: string
  ) => void;
};

export function CallingPendingParticipants({
  defaultIsExpanded,
  i18n,
  participants,
  approveUser,
  batchUserAction,
  denyUser,
  toggleCallLinkPendingParticipantModal,
}: PropsType): JSX.Element | null {
  const [isExpanded, setIsExpanded] = useState(defaultIsExpanded ?? false);
  const [confirmDialogState, setConfirmDialogState] =
    React.useState<ConfirmDialogState>(ConfirmDialogState.None);
  const [serviceIdsStagedForAction, setServiceIdsStagedForAction] =
    React.useState<Array<ServiceIdString>>([]);

  const expandedListRef = useRef<HTMLDivElement>(null);

  const handleHideAllRequests = useCallback(() => {
    setIsExpanded(false);
  }, [setIsExpanded]);

  // When opening the "Approve all" confirm dialog, save the current list of participants
  // to ensure we only approve users who the admin has checked. If additional people
  // request to join while the dialog is open, we don't auto approve those.
  const stageServiceIdsForAction = useCallback(() => {
    const serviceIds: Array<ServiceIdString> = [];
    participants.forEach(participant => {
      if (participant.serviceId) {
        serviceIds.push(participant.serviceId);
      }
    });
    setServiceIdsStagedForAction(serviceIds);
  }, [participants, setServiceIdsStagedForAction]);

  const hideConfirmDialog = useCallback(() => {
    setConfirmDialogState(ConfirmDialogState.None);
    setServiceIdsStagedForAction([]);
  }, [setConfirmDialogState]);

  const handleApprove = useCallback(
    (participant: ConversationType) => {
      const { serviceId } = participant;
      if (!serviceId) {
        return;
      }

      approveUser({ serviceId });
    },
    [approveUser]
  );

  const handleDeny = useCallback(
    (participant: ConversationType) => {
      const { serviceId } = participant;
      if (!serviceId) {
        return;
      }

      denyUser({ serviceId });
    },
    [denyUser]
  );

  const handleApproveAll = useCallback(() => {
    batchUserAction({
      action: 'approve',
      serviceIds: serviceIdsStagedForAction,
    });
    hideConfirmDialog();
  }, [serviceIdsStagedForAction, batchUserAction, hideConfirmDialog]);

  const handleDenyAll = useCallback(() => {
    batchUserAction({
      action: 'deny',
      serviceIds: serviceIdsStagedForAction,
    });
    hideConfirmDialog();
  }, [serviceIdsStagedForAction, batchUserAction, hideConfirmDialog]);

  const renderApprovalButtons = useCallback(
    (participant: ConversationType) => {
      if (participant.serviceId == null) {
        return null;
      }

      return (
        <>
          <Button
            aria-label={i18n('icu:CallingPendingParticipants__DenyUser')}
            className="CallingPendingParticipants__PendingActionButton CallingButton__icon"
            onClick={() => handleDeny(participant)}
            variant={ButtonVariant.Destructive}
          >
            <span className="CallingPendingParticipants__PendingActionButtonIcon CallingPendingParticipants__PendingActionButtonIcon--Deny" />
          </Button>
          <Button
            aria-label={i18n('icu:CallingPendingParticipants__ApproveUser')}
            className="CallingPendingParticipants__PendingActionButton CallingButton__icon"
            onClick={() => handleApprove(participant)}
            variant={ButtonVariant.Calling}
          >
            <span className="CallingPendingParticipants__PendingActionButtonIcon CallingPendingParticipants__PendingActionButtonIcon--Approve" />
          </Button>
        </>
      );
    },
    [i18n, handleApprove, handleDeny]
  );

  useEffect(() => {
    if (!isExpanded) {
      return noop;
    }
    return handleOutsideClick(
      () => {
        handleHideAllRequests();
        return true;
      },
      {
        containerElements: [expandedListRef],
        name: 'CallingPendingParticipantsList.expandedList',
      }
    );
  }, [isExpanded, handleHideAllRequests]);

  if (confirmDialogState === ConfirmDialogState.ApproveAll) {
    return (
      <ConfirmationDialog
        dialogName="CallingPendingParticipants.confirmDialog"
        actions={[
          {
            action: handleApproveAll,
            style: 'affirmative',
            text: i18n('icu:CallingPendingParticipants__ApproveAll'),
          },
        ]}
        cancelText={i18n('icu:cancel')}
        i18n={i18n}
        theme={Theme.Dark}
        title={i18n(
          'icu:CallingPendingParticipants__ConfirmDialogTitle--ApproveAll',
          { count: serviceIdsStagedForAction.length }
        )}
        onClose={hideConfirmDialog}
      >
        {i18n('icu:CallingPendingParticipants__ConfirmDialogBody--ApproveAll', {
          count: serviceIdsStagedForAction.length,
        })}
      </ConfirmationDialog>
    );
  }

  if (confirmDialogState === ConfirmDialogState.DenyAll) {
    return (
      <ConfirmationDialog
        dialogName="CallingPendingParticipants.confirmDialog"
        actions={[
          {
            action: handleDenyAll,
            style: 'affirmative',
            text: i18n('icu:CallingPendingParticipants__DenyAll'),
          },
        ]}
        cancelText={i18n('icu:cancel')}
        i18n={i18n}
        theme={Theme.Dark}
        title={i18n(
          'icu:CallingPendingParticipants__ConfirmDialogTitle--DenyAll',
          { count: serviceIdsStagedForAction.length }
        )}
        onClose={hideConfirmDialog}
      >
        {i18n('icu:CallingPendingParticipants__ConfirmDialogBody--DenyAll', {
          count: serviceIdsStagedForAction.length,
        })}
      </ConfirmationDialog>
    );
  }

  if (isExpanded) {
    return (
      <div
        className="CallingPendingParticipants CallingPendingParticipants--Expanded module-calling-participants-list"
        ref={expandedListRef}
      >
        <div className="module-calling-participants-list__header">
          <div className="module-calling-participants-list__title">
            {i18n('icu:CallingPendingParticipants__RequestsToJoin', {
              count: participants.length,
            })}
          </div>
          <button
            type="button"
            className="module-calling-participants-list__close"
            onClick={handleHideAllRequests}
            tabIndex={0}
            aria-label={i18n('icu:close')}
          />
        </div>
        <ul className="module-calling-participants-list__list">
          {participants.map((participant: ConversationType, index: number) => (
            <li
              className="module-calling-participants-list__contact"
              key={index}
            >
              <button
                type="button"
                onClick={ev => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  toggleCallLinkPendingParticipantModal(participant.id);
                }}
                className="module-calling-participants-list__avatar-and-name CallingPendingParticipants__ParticipantButton"
              >
                <Avatar
                  acceptedMessageRequest={participant.acceptedMessageRequest}
                  avatarUrl={participant.avatarUrl}
                  badge={undefined}
                  color={participant.color}
                  conversationType="direct"
                  i18n={i18n}
                  isMe={participant.isMe}
                  profileName={participant.profileName}
                  title={participant.title}
                  sharedGroupNames={participant.sharedGroupNames}
                  size={AvatarSize.THIRTY_SIX}
                />
                <ContactName
                  module="module-calling-participants-list__name"
                  title={participant.title}
                />
                {isInSystemContacts(participant) ? (
                  <span>
                    {' '}
                    <InContactsIcon
                      className="module-calling-participants-list__contact-icon"
                      i18n={i18n}
                    />
                  </span>
                ) : null}
              </button>
              {renderApprovalButtons(participant)}
            </li>
          ))}
        </ul>
        <div className="CallingPendingParticipants__ActionPanel">
          <Button
            className="CallingPendingParticipants__ActionPanelButton CallingPendingParticipants__ActionPanelButton--DenyAll"
            variant={ButtonVariant.Destructive}
            onClick={() => {
              stageServiceIdsForAction();
              setConfirmDialogState(ConfirmDialogState.DenyAll);
            }}
          >
            {i18n('icu:CallingPendingParticipants__DenyAll')}
          </Button>
          <Button
            className="CallingPendingParticipants__ActionPanelButton CallingPendingParticipants__ActionPanelButton--ApproveAll"
            variant={ButtonVariant.Calling}
            onClick={() => {
              stageServiceIdsForAction();
              setConfirmDialogState(ConfirmDialogState.ApproveAll);
            }}
          >
            {i18n('icu:CallingPendingParticipants__ApproveAll')}
          </Button>
        </div>
      </div>
    );
  }

  const participant = participants[0];
  return (
    <div className="CallingPendingParticipants CallingPendingParticipants--Compact module-calling-participants-list">
      <div className="CallingPendingParticipants__CompactParticipant">
        <button
          type="button"
          onClick={ev => {
            ev.preventDefault();
            ev.stopPropagation();
            toggleCallLinkPendingParticipantModal(participant.id);
          }}
          className="module-calling-participants-list__avatar-and-name CallingPendingParticipants__ParticipantButton"
        >
          <Avatar
            acceptedMessageRequest={participant.acceptedMessageRequest}
            avatarUrl={participant.avatarUrl}
            badge={undefined}
            color={participant.color}
            conversationType="direct"
            i18n={i18n}
            isMe={participant.isMe}
            profileName={participant.profileName}
            title={participant.title}
            sharedGroupNames={participant.sharedGroupNames}
            size={AvatarSize.FORTY_EIGHT}
          />
          <div className="CallingPendingParticipants__CompactParticipantNameColumn">
            <div className="CallingPendingParticipants__ParticipantName">
              <ContactName title={participant.title} />
              {isInSystemContacts(participant) ? (
                <InContactsIcon
                  className="module-calling-participants-list__contact-icon"
                  i18n={i18n}
                />
              ) : null}
              <span className="CallingPendingParticipants__ParticipantAboutIcon" />
            </div>
            <div className="CallingPendingParticipants__WouldLikeToJoin">
              {i18n('icu:CallingPendingParticipants__WouldLikeToJoin')}
            </div>
          </div>
        </button>
        {renderApprovalButtons(participant)}
      </div>
      {participants.length > 1 && (
        <div className="CallingPendingParticipants__ShowAllRequestsButtonContainer">
          <button
            className="CallingPendingParticipants__ShowAllRequestsButton"
            onClick={() => setIsExpanded(true)}
            type="button"
          >
            {i18n('icu:CallingPendingParticipants__AdditionalRequests', {
              count: participants.length - 1,
            })}
          </button>
        </div>
      )}
    </div>
  );
}

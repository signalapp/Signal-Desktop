// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable react/no-array-index-key */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { noop } from 'lodash';
import classNames from 'classnames';
import { animated, useSpring } from '@react-spring/web';
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
import { usePrevious } from '../hooks/usePrevious';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { drop } from '../util/drop';

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
  const reducedMotion = useReducedMotion();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const [opacitySpringProps, opacitySpringApi] = useSpring(
    {
      from: { opacity: 0 },
      to: { opacity: 1 },
      config: { clamp: true, friction: 22, tension: 360 },
      immediate: reducedMotion,
    },
    []
  );

  // We show the first pending participant. Save this participant, so if all requests
  // are resolved then we can keep showing the participant while fading out.
  const lastParticipantRef = React.useRef<ConversationType | undefined>();
  lastParticipantRef.current = participants[0] ?? lastParticipantRef.current;
  const participantCount = participants.length;
  const prevParticipantCount = usePrevious(participantCount, participantCount);

  const [isVisible, setIsVisible] = useState(participantCount > 0);
  const [isExpanded, setIsExpanded] = useState(defaultIsExpanded ?? false);
  const [confirmDialogState, setConfirmDialogState] =
    useState<ConfirmDialogState>(ConfirmDialogState.None);
  const [serviceIdsStagedForAction, setServiceIdsStagedForAction] = useState<
    Array<ServiceIdString>
  >([]);

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
    (participant: ConversationType, isEnabled: boolean = true) => {
      if (participant.serviceId == null) {
        return null;
      }

      return (
        <>
          <Button
            aria-label={i18n('icu:CallingPendingParticipants__DenyUser')}
            className="CallingPendingParticipants__PendingActionButton CallingButton__icon"
            onClick={isEnabled ? () => handleDeny(participant) : noop}
            variant={ButtonVariant.Destructive}
          >
            <span className="CallingPendingParticipants__PendingActionButtonIcon CallingPendingParticipants__PendingActionButtonIcon--Deny" />
          </Button>
          <Button
            aria-label={i18n('icu:CallingPendingParticipants__ApproveUser')}
            className="CallingPendingParticipants__PendingActionButton CallingButton__icon"
            onClick={isEnabled ? () => handleApprove(participant) : noop}
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

  useEffect(() => {
    if (participantCount > prevParticipantCount) {
      setIsVisible(true);
      opacitySpringApi.stop();
      drop(Promise.all(opacitySpringApi.start({ opacity: 1 })));
    } else if (participantCount === 0) {
      opacitySpringApi.stop();
      drop(
        Promise.all(
          opacitySpringApi.start({
            to: { opacity: 0 },
            onRest: () => {
              if (!participantCount) {
                setIsVisible(false);
              }
            },
          })
        )
      );
    }
  }, [opacitySpringApi, participantCount, prevParticipantCount, setIsVisible]);

  if (!isVisible) {
    return null;
  }

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
              count: participantCount,
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

  const participant = lastParticipantRef.current;
  if (!participant) {
    return null;
  }

  const isExpandable = participantCount > 1;
  return (
    <animated.div
      className={classNames(
        'CallingPendingParticipants',
        'CallingPendingParticipants--Compact',
        'module-calling-participants-list',
        isExpandable && 'CallingPendingParticipants--Expandable'
      )}
      style={opacitySpringProps}
      aria-hidden={participantCount === 0}
    >
      <div className="CallingPendingParticipants__CompactParticipant">
        <button
          type="button"
          onClick={ev => {
            ev.preventDefault();
            ev.stopPropagation();
            if (participantCount === 0) {
              return;
            }

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
        {renderApprovalButtons(participant, participantCount > 0)}
      </div>
      {isExpandable && (
        <div className="CallingPendingParticipants__ShowAllRequestsButtonContainer">
          <button
            className="CallingPendingParticipants__ShowAllRequestsButton"
            onClick={() => setIsExpanded(true)}
            type="button"
          >
            {i18n('icu:CallingPendingParticipants__AdditionalRequests', {
              count: participantCount - 1,
            })}
          </button>
        </div>
      )}
    </animated.div>
  );
}

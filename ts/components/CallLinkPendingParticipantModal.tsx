// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useEffect, useMemo } from 'react';
import { Modal } from './Modal';
import type { LocalizerType } from '../types/I18N';
import { Avatar, AvatarSize } from './Avatar';
import type { PendingUserActionPayloadType } from '../state/ducks/calling';
import type { ConversationType } from '../state/ducks/conversations';
import { InContactsIcon } from './InContactsIcon';
import { isInSystemContacts } from '../util/isInSystemContacts';
import { ThemeType } from '../types/Util';
import { Theme } from '../util/theme';
import { UserText } from './UserText';
import { SharedGroupNames } from './SharedGroupNames';

export type CallLinkPendingParticipantModalProps = {
  readonly i18n: LocalizerType;
  readonly conversation: ConversationType;
  readonly approveUser: (payload: PendingUserActionPayloadType) => void;
  readonly denyUser: (payload: PendingUserActionPayloadType) => void;
  readonly onClose: () => void;
  readonly toggleAboutContactModal: (conversationId: string) => void;
  readonly updateSharedGroups: (conversationId: string) => void;
};

export function CallLinkPendingParticipantModal({
  i18n,
  conversation,
  approveUser,
  denyUser,
  onClose,
  toggleAboutContactModal,
  updateSharedGroups,
}: CallLinkPendingParticipantModalProps): JSX.Element {
  useEffect(() => {
    // Kick off the expensive hydration of the current sharedGroupNames
    updateSharedGroups(conversation.id);
  }, [conversation.id, updateSharedGroups]);

  const serviceId = useMemo(() => {
    return conversation.serviceId;
  }, [conversation]);

  const handleApprove = useCallback(() => {
    approveUser({ serviceId });
    onClose();
  }, [approveUser, onClose, serviceId]);

  const handleDeny = useCallback(() => {
    denyUser({ serviceId });
    onClose();
  }, [denyUser, onClose, serviceId]);

  return (
    <Modal
      modalName="CallLinkPendingParticipantModal"
      moduleClassName="CallLinkPendingParticipantModal"
      hasXButton
      i18n={i18n}
      onClose={onClose}
      theme={Theme.Dark}
    >
      <Avatar
        acceptedMessageRequest={conversation.acceptedMessageRequest}
        avatarUrl={conversation.avatarUrl}
        badge={undefined}
        color={conversation.color}
        conversationType="direct"
        i18n={i18n}
        isMe={conversation.isMe}
        profileName={conversation.profileName}
        sharedGroupNames={conversation.sharedGroupNames}
        size={AvatarSize.EIGHTY}
        title={conversation.title}
        theme={ThemeType.dark}
        unblurredAvatarUrl={conversation.unblurredAvatarUrl}
      />

      <button
        type="button"
        onClick={ev => {
          ev.preventDefault();
          ev.stopPropagation();
          toggleAboutContactModal(conversation.id);
        }}
        className="CallLinkPendingParticipantModal__NameButton"
      >
        <div className="CallLinkPendingParticipantModal__Title">
          <UserText text={conversation.title} />
          {isInSystemContacts(conversation) && (
            <span>
              {' '}
              <InContactsIcon
                className="module-in-contacts-icon__icon CallLinkPendingParticipantModal__InContactsIcon"
                i18n={i18n}
              />
            </span>
          )}
          <span className="CallLinkPendingParticipantModal__AboutIcon" />
        </div>
      </button>

      <div className="CallLinkPendingParticipantModal__SharedGroupInfo">
        {conversation.sharedGroupNames?.length ? (
          <SharedGroupNames
            i18n={i18n}
            sharedGroupNames={conversation.sharedGroupNames || []}
          />
        ) : (
          i18n('icu:no-groups-in-common-warning')
        )}
      </div>

      <div className="CallLinkPendingParticipantModal__Hr" />

      <button
        type="button"
        className="CallLinkPendingParticipantModal__ActionButton"
        onClick={handleApprove}
      >
        <div className="CallLinkPendingParticipantModal__ButtonIcon">
          <div className="CallLinkPendingParticipantModal__ButtonIconContent CallLinkPendingParticipantModal__ButtonIconContent--approve" />
        </div>
        {i18n('icu:CallLinkPendingParticipantModal__ApproveButtonLabel')}
      </button>

      <button
        type="button"
        className="CallLinkPendingParticipantModal__ActionButton"
        onClick={handleDeny}
      >
        <div className="CallLinkPendingParticipantModal__ButtonIcon">
          <div className="CallLinkPendingParticipantModal__ButtonIconContent CallLinkPendingParticipantModal__ButtonIconContent--deny" />
        </div>
        {i18n('icu:CallLinkPendingParticipantModal__DenyButtonLabel')}
      </button>
    </Modal>
  );
}

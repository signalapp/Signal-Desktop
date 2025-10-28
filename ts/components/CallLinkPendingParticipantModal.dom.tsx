// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useEffect, useMemo } from 'react';
import { Modal } from './Modal.dom.js';
import type { LocalizerType } from '../types/I18N.std.js';
import { Avatar, AvatarSize } from './Avatar.dom.js';
import type { PendingUserActionPayloadType } from '../state/ducks/calling.preload.js';
import type { ConversationType } from '../state/ducks/conversations.preload.js';
import { InContactsIcon } from './InContactsIcon.dom.js';
import { isInSystemContacts } from '../util/isInSystemContacts.std.js';
import { ThemeType } from '../types/Util.std.js';
import { Theme } from '../util/theme.std.js';
import { UserText } from './UserText.dom.js';
import { SharedGroupNames } from './SharedGroupNames.dom.js';

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
        avatarUrl={conversation.avatarUrl}
        avatarPlaceholderGradient={conversation.avatarPlaceholderGradient}
        badge={undefined}
        color={conversation.color}
        conversationType="direct"
        hasAvatar={conversation.hasAvatar}
        i18n={i18n}
        profileName={conversation.profileName}
        sharedGroupNames={conversation.sharedGroupNames}
        size={AvatarSize.EIGHTY}
        title={conversation.title}
        theme={ThemeType.dark}
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

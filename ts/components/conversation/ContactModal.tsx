// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useState } from 'react';

import { About } from './About';
import { Avatar } from '../Avatar';
import { AvatarLightbox } from '../AvatarLightbox';
import { ConversationType } from '../../state/ducks/conversations';
import { Modal } from '../Modal';
import { LocalizerType } from '../../types/Util';
import { SharedGroupNames } from '../SharedGroupNames';
import { ConfirmationDialog } from '../ConfirmationDialog';

export type PropsDataType = {
  areWeAdmin: boolean;
  contact?: ConversationType;
  conversationId?: string;
  readonly i18n: LocalizerType;
  isAdmin: boolean;
  isMember: boolean;
};

type PropsActionType = {
  hideContactModal: () => void;
  openConversationInternal: (
    options: Readonly<{
      conversationId: string;
      messageId?: string;
      switchToAssociatedView?: boolean;
    }>
  ) => void;
  removeMemberFromGroup: (conversationId: string, contactId: string) => void;
  toggleAdmin: (conversationId: string, contactId: string) => void;
  toggleSafetyNumberModal: (conversationId: string) => unknown;
  updateConversationModelSharedGroups: (conversationId: string) => void;
};

export type PropsType = PropsDataType & PropsActionType;

export const ContactModal = ({
  areWeAdmin,
  contact,
  conversationId,
  hideContactModal,
  i18n,
  isAdmin,
  isMember,
  openConversationInternal,
  removeMemberFromGroup,
  toggleAdmin,
  toggleSafetyNumberModal,
  updateConversationModelSharedGroups,
}: PropsType): JSX.Element => {
  if (!contact) {
    throw new Error('Contact modal opened without a matching contact');
  }

  const [showingAvatar, setShowingAvatar] = useState(false);
  const [confirmToggleAdmin, setConfirmToggleAdmin] = useState(false);

  useEffect(() => {
    if (conversationId) {
      // Kick off the expensive hydration of the current sharedGroupNames
      updateConversationModelSharedGroups(conversationId);
    }
  }, [conversationId, updateConversationModelSharedGroups]);

  if (showingAvatar) {
    return (
      <AvatarLightbox
        avatarColor={contact.color}
        avatarPath={contact.avatarPath}
        conversationTitle={contact.title}
        i18n={i18n}
        onClose={() => setShowingAvatar(false)}
      />
    );
  }

  return (
    <Modal
      moduleClassName="ContactModal__modal"
      hasXButton
      i18n={i18n}
      onClose={hideContactModal}
    >
      <div className="ContactModal">
        <Avatar
          acceptedMessageRequest={contact.acceptedMessageRequest}
          avatarPath={contact.avatarPath}
          color={contact.color}
          conversationType="direct"
          i18n={i18n}
          isMe={contact.isMe}
          name={contact.name}
          profileName={contact.profileName}
          sharedGroupNames={contact.sharedGroupNames}
          size={96}
          title={contact.title}
          unblurredAvatarPath={contact.unblurredAvatarPath}
          onClick={() => setShowingAvatar(true)}
        />
        <div className="ContactModal__name">{contact.title}</div>
        <div className="module-about__container">
          <About text={contact.about} />
        </div>
        {contact.phoneNumber && (
          <div className="ContactModal__info">{contact.phoneNumber}</div>
        )}
        {!contact.isMe && (
          <div className="ContactModal__info">
            <SharedGroupNames
              i18n={i18n}
              sharedGroupNames={contact.sharedGroupNames || []}
            />
          </div>
        )}
        <div className="ContactModal__button-container">
          <button
            type="button"
            className="ContactModal__button ContactModal__send-message"
            onClick={() => {
              hideContactModal();
              openConversationInternal({ conversationId: contact.id });
            }}
          >
            <div className="ContactModal__bubble-icon">
              <div className="ContactModal__send-message__bubble-icon" />
            </div>
            <span>{i18n('ContactModal--message')}</span>
          </button>
          {!contact.isMe && (
            <button
              type="button"
              className="ContactModal__button ContactModal__safety-number"
              onClick={() => {
                hideContactModal();
                toggleSafetyNumberModal(contact.id);
              }}
            >
              <div className="ContactModal__bubble-icon">
                <div className="ContactModal__safety-number__bubble-icon" />
              </div>
              <span>{i18n('showSafetyNumber')}</span>
            </button>
          )}
          {!contact.isMe && areWeAdmin && isMember && conversationId && (
            <>
              <button
                type="button"
                className="ContactModal__button ContactModal__make-admin"
                onClick={() => setConfirmToggleAdmin(true)}
              >
                <div className="ContactModal__bubble-icon">
                  <div className="ContactModal__make-admin__bubble-icon" />
                </div>
                {isAdmin ? (
                  <span>{i18n('ContactModal--rm-admin')}</span>
                ) : (
                  <span>{i18n('ContactModal--make-admin')}</span>
                )}
              </button>
              <button
                type="button"
                className="ContactModal__button ContactModal__remove-from-group"
                onClick={() =>
                  removeMemberFromGroup(conversationId, contact.id)
                }
              >
                <div className="ContactModal__bubble-icon">
                  <div className="ContactModal__remove-from-group__bubble-icon" />
                </div>
                <span>{i18n('ContactModal--remove-from-group')}</span>
              </button>
            </>
          )}
        </div>
        {confirmToggleAdmin && conversationId && (
          <ConfirmationDialog
            actions={[
              {
                action: () => toggleAdmin(conversationId, contact.id),
                text: isAdmin
                  ? i18n('ContactModal--rm-admin')
                  : i18n('ContactModal--make-admin'),
              },
            ]}
            i18n={i18n}
            onClose={() => setConfirmToggleAdmin(false)}
          >
            {isAdmin
              ? i18n('ContactModal--rm-admin-info', [contact.title])
              : i18n('ContactModal--make-admin-info', [contact.title])}
          </ConfirmationDialog>
        )}
      </div>
    </Modal>
  );
};

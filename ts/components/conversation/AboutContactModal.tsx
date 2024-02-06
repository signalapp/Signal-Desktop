// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useEffect } from 'react';
import type { ConversationType } from '../../state/ducks/conversations';
import type { LocalizerType } from '../../types/Util';
import { isInSystemContacts } from '../../util/isInSystemContacts';
import { Avatar, AvatarSize } from '../Avatar';
import { Modal } from '../Modal';
import { UserText } from '../UserText';
import { SharedGroupNames } from '../SharedGroupNames';
import { About } from './About';

export type PropsType = Readonly<{
  i18n: LocalizerType;
  onClose: () => void;
}> &
  ExternalPropsType;

export type ExternalPropsType = Readonly<{
  conversation: ConversationType;
  isSignalConnection: boolean;
  toggleSignalConnectionsModal: () => void;
  updateSharedGroups: (id: string) => void;
}>;

export function AboutContactModal({
  i18n,
  conversation,
  isSignalConnection,
  toggleSignalConnectionsModal,
  updateSharedGroups,
  onClose,
}: PropsType): JSX.Element {
  useEffect(() => {
    // Kick off the expensive hydration of the current sharedGroupNames
    updateSharedGroups(conversation.id);
  }, [conversation.id, updateSharedGroups]);

  const onSignalConnectionClick = useCallback(
    (ev: React.MouseEvent) => {
      ev.preventDefault();
      toggleSignalConnectionsModal();
    },
    [toggleSignalConnectionsModal]
  );

  return (
    <Modal
      key="main"
      modalName="AboutContactModal"
      moduleClassName="AboutContactModal"
      hasXButton
      i18n={i18n}
      onClose={onClose}
    >
      <div className="AboutContactModal__row AboutContactModal__row--centered">
        <Avatar
          acceptedMessageRequest={conversation.acceptedMessageRequest}
          avatarPath={conversation.avatarPath}
          badge={undefined}
          color={conversation.color}
          conversationType="direct"
          i18n={i18n}
          isMe={conversation.isMe}
          profileName={conversation.profileName}
          sharedGroupNames={[]}
          size={AvatarSize.TWO_HUNDRED_SIXTEEN}
          title={conversation.title}
          unblurredAvatarPath={conversation.unblurredAvatarPath}
        />
      </div>

      <div className="AboutContactModal__row">
        <h3 className="AboutContactModal__title">
          {i18n('icu:AboutContactModal__title')}
        </h3>
      </div>

      <div className="AboutContactModal__row">
        <i className="AboutContactModal__row__icon AboutContactModal__row__icon--profile" />
        <UserText text={conversation.title} />
      </div>

      {conversation.about ? (
        <div className="AboutContactModal__row">
          <i className="AboutContactModal__row__icon AboutContactModal__row__icon--about" />
          <About
            className="AboutContactModal__about"
            text={conversation.about}
          />
        </div>
      ) : null}

      {isSignalConnection ? (
        <div className="AboutContactModal__row">
          <i className="AboutContactModal__row__icon AboutContactModal__row__icon--connections" />
          <button
            type="button"
            className="AboutContactModal__signal-connection"
            onClick={onSignalConnectionClick}
          >
            {i18n('icu:AboutContactModal__signal-connection')}
          </button>
        </div>
      ) : null}

      {isInSystemContacts(conversation) ? (
        <div className="AboutContactModal__row">
          <i className="AboutContactModal__row__icon AboutContactModal__row__icon--person" />
          {i18n('icu:AboutContactModal__system-contact', {
            name: conversation.firstName || conversation.title,
          })}
        </div>
      ) : null}

      {conversation.phoneNumber ? (
        <div className="AboutContactModal__row">
          <i className="AboutContactModal__row__icon AboutContactModal__row__icon--phone" />
          <UserText text={conversation.phoneNumber} />
        </div>
      ) : null}

      <div className="AboutContactModal__row">
        <i className="AboutContactModal__row__icon AboutContactModal__row__icon--group" />
        <div>
          <SharedGroupNames
            i18n={i18n}
            sharedGroupNames={conversation.sharedGroupNames || []}
          />
        </div>
      </div>
    </Modal>
  );
}

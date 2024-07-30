// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useEffect } from 'react';
import type { ConversationType } from '../../state/ducks/conversations';
import type { LocalizerType } from '../../types/Util';
import { isInSystemContacts } from '../../util/isInSystemContacts';
import { shouldBlurAvatar } from '../../util/shouldBlurAvatar';
import { Avatar, AvatarBlur, AvatarSize } from '../Avatar';
import { Modal } from '../Modal';
import { UserText } from '../UserText';
import { SharedGroupNames } from '../SharedGroupNames';
import { About } from './About';
import { I18n } from '../I18n';
import { canHaveNicknameAndNote } from '../../util/nicknames';
import { Tooltip, TooltipPlacement } from '../Tooltip';

function muted(parts: Array<string | JSX.Element>) {
  return (
    <span className="AboutContactModal__TitleWithoutNickname">{parts}</span>
  );
}

export type PropsType = Readonly<{
  i18n: LocalizerType;
  onClose: () => void;
  onOpenNotePreviewModal: () => void;
  conversation: ConversationType;
  isSignalConnection: boolean;
  toggleSignalConnectionsModal: () => void;
  toggleSafetyNumberModal: (id: string) => void;
  updateSharedGroups: (id: string) => void;
  unblurAvatar: (conversationId: string) => void;
}>;

export function AboutContactModal({
  i18n,
  conversation,
  isSignalConnection,
  toggleSignalConnectionsModal,
  toggleSafetyNumberModal,
  updateSharedGroups,
  unblurAvatar,
  onClose,
  onOpenNotePreviewModal,
}: PropsType): JSX.Element {
  const { isMe } = conversation;

  useEffect(() => {
    // Kick off the expensive hydration of the current sharedGroupNames
    updateSharedGroups(conversation.id);
  }, [conversation.id, updateSharedGroups]);

  const avatarBlur = shouldBlurAvatar(conversation)
    ? AvatarBlur.BlurPictureWithClickToView
    : AvatarBlur.NoBlur;

  const onAvatarClick = useCallback(() => {
    if (avatarBlur === AvatarBlur.BlurPictureWithClickToView) {
      unblurAvatar(conversation.id);
    }
  }, [avatarBlur, unblurAvatar, conversation.id]);

  const onSignalConnectionClick = useCallback(
    (ev: React.MouseEvent) => {
      ev.preventDefault();
      toggleSignalConnectionsModal();
    },
    [toggleSignalConnectionsModal]
  );

  const onVerifiedClick = useCallback(
    (ev: React.MouseEvent) => {
      ev.preventDefault();
      toggleSafetyNumberModal(conversation.id);
    },
    [toggleSafetyNumberModal, conversation.id]
  );

  let statusRow: JSX.Element | undefined;

  if (isMe) {
    // No status for ourselves
  } else if (conversation.isBlocked) {
    statusRow = (
      <div className="AboutContactModal__row">
        <i className="AboutContactModal__row__icon AboutContactModal__row__icon--blocked" />
        {i18n('icu:AboutContactModal__blocked', {
          name: conversation.title,
        })}
      </div>
    );
  } else if (!conversation.acceptedMessageRequest) {
    statusRow = (
      <div className="AboutContactModal__row">
        <i className="AboutContactModal__row__icon AboutContactModal__row__icon--message-request" />
        {i18n('icu:AboutContactModal__message-request')}
      </div>
    );
  } else if (!conversation.hasMessages && !conversation.profileSharing) {
    statusRow = (
      <div className="AboutContactModal__row">
        <i className="AboutContactModal__row__icon AboutContactModal__row__icon--no-dms" />
        {i18n('icu:AboutContactModal__no-dms', {
          name: conversation.title,
        })}
      </div>
    );
  }

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
          avatarUrl={conversation.avatarUrl}
          blur={avatarBlur}
          onClick={avatarBlur === AvatarBlur.NoBlur ? undefined : onAvatarClick}
          badge={undefined}
          color={conversation.color}
          conversationType="direct"
          i18n={i18n}
          isMe={conversation.isMe}
          profileName={conversation.profileName}
          sharedGroupNames={[]}
          size={AvatarSize.TWO_HUNDRED_SIXTEEN}
          title={conversation.title}
          unblurredAvatarUrl={conversation.unblurredAvatarUrl}
        />
      </div>

      <div className="AboutContactModal__row">
        <h3 className="AboutContactModal__title">
          {isMe
            ? i18n('icu:AboutContactModal__title--myself')
            : i18n('icu:AboutContactModal__title')}
        </h3>
      </div>

      <div className="AboutContactModal__row">
        <i className="AboutContactModal__row__icon AboutContactModal__row__icon--profile" />

        {canHaveNicknameAndNote(conversation) &&
        (conversation.nicknameGivenName || conversation.nicknameFamilyName) &&
        conversation.titleNoNickname ? (
          <span>
            <I18n
              i18n={i18n}
              id="icu:AboutContactModal__TitleAndTitleWithoutNickname"
              components={{
                nickname: <UserText text={conversation.title} />,
                titleNoNickname: (
                  <Tooltip
                    className="AboutContactModal__TitleWithoutNickname__Tooltip"
                    direction={TooltipPlacement.Top}
                    content={
                      <I18n
                        i18n={i18n}
                        id="icu:AboutContactModal__TitleWithoutNickname__Tooltip"
                        components={{
                          title: (
                            <UserText text={conversation.titleNoNickname} />
                          ),
                        }}
                      />
                    }
                    delay={0}
                  >
                    <UserText text={conversation.titleNoNickname} />
                  </Tooltip>
                ),
                muted,
              }}
            />
          </span>
        ) : (
          <UserText text={conversation.title} />
        )}
      </div>

      {!isMe && conversation.isVerified ? (
        <div className="AboutContactModal__row">
          <i className="AboutContactModal__row__icon AboutContactModal__row__icon--verified" />
          <button
            type="button"
            className="AboutContactModal__verified"
            onClick={onVerifiedClick}
          >
            {i18n('icu:AboutContactModal__verified')}
          </button>
        </div>
      ) : null}

      {!isMe && conversation.about ? (
        <div className="AboutContactModal__row">
          <i className="AboutContactModal__row__icon AboutContactModal__row__icon--about" />
          <About
            className="AboutContactModal__about"
            text={conversation.about}
          />
        </div>
      ) : null}

      {!isMe && isSignalConnection ? (
        <div className="AboutContactModal__row">
          <i className="AboutContactModal__row__icon AboutContactModal__row__icon--connections" />
          <button
            type="button"
            className="AboutContactModal__button"
            onClick={onSignalConnectionClick}
          >
            {i18n('icu:AboutContactModal__signal-connection')}
          </button>
        </div>
      ) : null}

      {!isMe && isInSystemContacts(conversation) ? (
        <div className="AboutContactModal__row">
          <i className="AboutContactModal__row__icon AboutContactModal__row__icon--person" />
          {i18n('icu:AboutContactModal__system-contact', {
            name:
              conversation.systemGivenName ||
              conversation.firstName ||
              conversation.title,
          })}
        </div>
      ) : null}

      {conversation.phoneNumber ? (
        <div className="AboutContactModal__row">
          <i className="AboutContactModal__row__icon AboutContactModal__row__icon--phone" />
          <UserText text={conversation.phoneNumber} />
        </div>
      ) : null}

      {!isMe && (
        <div className="AboutContactModal__row">
          <i className="AboutContactModal__row__icon AboutContactModal__row__icon--group" />
          <div>
            <SharedGroupNames
              i18n={i18n}
              sharedGroupNames={conversation.sharedGroupNames || []}
            />
          </div>
        </div>
      )}

      {conversation.note && (
        <div className="AboutContactModal__row">
          <i className="AboutContactModal__row__icon AboutContactModal__row__icon--note" />
          <button
            type="button"
            className="AboutContactModal__button"
            onClick={onOpenNotePreviewModal}
          >
            <div className="AboutContactModal__OneLineEllipsis">
              <UserText text={conversation.note} />
            </div>
          </button>
        </div>
      )}

      {statusRow}
    </Modal>
  );
}

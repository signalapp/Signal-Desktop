// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { type ReactNode, useCallback, useEffect, useMemo } from 'react';
import type { ConversationType } from '../../state/ducks/conversations.preload.js';
import type { LocalizerType } from '../../types/Util.std.js';
import { isInSystemContacts } from '../../util/isInSystemContacts.std.js';
import { Avatar, AvatarBlur, AvatarSize } from '../Avatar.dom.js';
import { Modal } from '../Modal.dom.js';
import { UserText } from '../UserText.dom.js';
import { SharedGroupNames } from '../SharedGroupNames.dom.js';
import { About } from './About.dom.js';
import { I18n } from '../I18n.dom.js';
import { canHaveNicknameAndNote } from '../../util/nicknames.dom.js';
import { Tooltip, TooltipPlacement } from '../Tooltip.dom.js';

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
  fromOrAddedByTrustedContact?: boolean;
  isSignalConnection: boolean;
  pendingAvatarDownload?: boolean;
  startAvatarDownload?: (id: string) => unknown;
  toggleSignalConnectionsModal: () => void;
  toggleSafetyNumberModal: (id: string) => void;
  toggleProfileNameWarningModal: () => void;
  updateSharedGroups: (id: string) => void;
}>;

export function AboutContactModal({
  i18n,
  conversation,
  fromOrAddedByTrustedContact,
  isSignalConnection,
  pendingAvatarDownload,
  startAvatarDownload,
  toggleSignalConnectionsModal,
  toggleSafetyNumberModal,
  toggleProfileNameWarningModal,
  updateSharedGroups,
  onClose,
  onOpenNotePreviewModal,
}: PropsType): JSX.Element {
  const { avatarUrl, hasAvatar, isMe } = conversation;

  useEffect(() => {
    // Kick off the expensive hydration of the current sharedGroupNames
    updateSharedGroups(conversation.id);
  }, [conversation.id, updateSharedGroups]);

  // If hasAvatar is true, we show the download button instead of blur
  const enableClickToLoad = !avatarUrl && !isMe && hasAvatar;

  const avatarBlur = enableClickToLoad
    ? AvatarBlur.BlurPictureWithClickToView
    : AvatarBlur.NoBlur;

  const avatarOnClick = useMemo(() => {
    if (!enableClickToLoad) {
      return undefined;
    }
    return () => {
      if (!pendingAvatarDownload && startAvatarDownload) {
        startAvatarDownload(conversation.id);
      }
    };
  }, [
    conversation.id,
    startAvatarDownload,
    enableClickToLoad,
    pendingAvatarDownload,
  ]);

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

  const onProfileNameWarningClick = useCallback(
    (ev: React.MouseEvent) => {
      ev.preventDefault();
      toggleProfileNameWarningModal();
    },
    [toggleProfileNameWarningModal]
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
          avatarPlaceholderGradient={conversation.avatarPlaceholderGradient}
          avatarUrl={conversation.avatarUrl}
          blur={avatarBlur}
          onClick={avatarOnClick}
          badge={undefined}
          color={conversation.color}
          conversationType="direct"
          hasAvatar={conversation.hasAvatar}
          i18n={i18n}
          loading={pendingAvatarDownload && !conversation.avatarUrl}
          profileName={conversation.profileName}
          sharedGroupNames={[]}
          size={AvatarSize.TWO_HUNDRED_SIXTEEN}
          title={conversation.title}
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

      {!isMe && !fromOrAddedByTrustedContact ? (
        <div className="AboutContactModal__row">
          <i
            className={`AboutContactModal__row__icon AboutContactModal__row__icon--${conversation.type === 'group' ? 'group' : 'direct'}-question`}
          />
          <button
            type="button"
            className="AboutContactModal__button"
            onClick={onProfileNameWarningClick}
          >
            <I18n
              components={{
                // eslint-disable-next-line react/no-unstable-nested-components
                clickable: (parts: ReactNode) => <>{parts}</>,
              }}
              i18n={i18n}
              id={
                conversation.type === 'group'
                  ? 'icu:ConversationHero--group-names'
                  : 'icu:ConversationHero--profile-names'
              }
            />
          </button>
        </div>
      ) : null}

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

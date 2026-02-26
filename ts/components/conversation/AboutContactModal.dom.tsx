// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { type ReactNode, useCallback, useMemo } from 'react';

import { isInSystemContacts } from '../../util/isInSystemContacts.std.js';
import { Avatar, AvatarBlur, AvatarSize } from '../Avatar.dom.js';
import { Modal } from '../Modal.dom.js';
import { UserText } from '../UserText.dom.js';
import { SharedGroupNames } from '../SharedGroupNames.dom.js';
import { About } from './About.dom.js';
import { I18n } from '../I18n.dom.js';
import { canHaveNicknameAndNote } from '../../util/nicknames.dom.js';
import { Tooltip, TooltipPlacement } from '../Tooltip.dom.js';
import { useFunEmojiLocalizer } from '../fun/useFunEmojiLocalizer.dom.js';
import {
  getEmojiVariantByKey,
  getEmojiVariantKeyByValue,
  isEmojiVariantValue,
} from '../fun/data/emojis.std.js';
import { FunStaticEmoji } from '../fun/FunEmoji.dom.js';
import { missingEmojiPlaceholder } from '../../types/GroupMemberLabels.std.js';

import type { ConversationType } from '../../state/ducks/conversations.preload.js';
import type { LocalizerType } from '../../types/Util.std.js';

function muted(parts: Array<string | React.JSX.Element>) {
  return (
    <span className="AboutContactModal__TitleWithoutNickname">{parts}</span>
  );
}

export type PropsType = Readonly<{
  i18n: LocalizerType;
  canAddLabel: boolean;
  contact: ConversationType;
  contactLabelEmoji: string | undefined;
  contactLabelString: string | undefined;
  contactNameColor: string | undefined;
  fromOrAddedByTrustedContact?: boolean;
  isEditMemberLabelEnabled: boolean;
  isSignalConnection: boolean;
  onClose: () => void;
  onOpenNotePreviewModal: () => void;
  pendingAvatarDownload?: boolean;
  sharedGroupNames: ReadonlyArray<string>;
  showEditMemberLabelScreen: () => unknown;
  showProfileEditor: () => unknown;
  showQRCodeScreen: () => unknown;
  startAvatarDownload?: (id: string) => unknown;
  toggleSignalConnectionsModal: () => void;
  toggleSafetyNumberModal: (id: string) => void;
  toggleProfileNameWarningModal: () => void;
}>;

export function AboutContactModal({
  i18n,
  canAddLabel,
  contact,
  contactLabelEmoji,
  contactLabelString,
  contactNameColor,
  fromOrAddedByTrustedContact,
  isEditMemberLabelEnabled,
  isSignalConnection,
  pendingAvatarDownload,
  sharedGroupNames,
  showEditMemberLabelScreen,
  showProfileEditor,
  showQRCodeScreen,
  startAvatarDownload,
  toggleSignalConnectionsModal,
  toggleSafetyNumberModal,
  toggleProfileNameWarningModal,
  onClose,
  onOpenNotePreviewModal,
}: PropsType): React.JSX.Element {
  const { avatarUrl, hasAvatar, isMe } = contact;

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
        startAvatarDownload(contact.id);
      }
    };
  }, [
    contact.id,
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
      toggleSafetyNumberModal(contact.id);
    },
    [toggleSafetyNumberModal, contact.id]
  );

  const onProfileNameWarningClick = useCallback(
    (ev: React.MouseEvent) => {
      ev.preventDefault();
      toggleProfileNameWarningModal();
    },
    [toggleProfileNameWarningModal]
  );

  let statusRow: React.JSX.Element | undefined;
  const hasLabel = contactNameColor && contactLabelString;
  const shouldShowLabel = isMe && hasLabel;
  const shouldShowAddLabel =
    isMe && !hasLabel && canAddLabel && isEditMemberLabelEnabled;
  const emojiLocalizer = useFunEmojiLocalizer();

  let labelEmojiElement;
  if (
    shouldShowLabel &&
    contactLabelEmoji &&
    isEmojiVariantValue(contactLabelEmoji)
  ) {
    const emojiKey = getEmojiVariantKeyByValue(contactLabelEmoji);
    const labelEmojiData = getEmojiVariantByKey(emojiKey);
    labelEmojiElement = (
      <>
        <FunStaticEmoji
          role="img"
          aria-label={emojiLocalizer.getLocaleShortName(labelEmojiData.key)}
          size={14}
          emoji={labelEmojiData}
        />{' '}
      </>
    );
  } else if (shouldShowLabel && contactLabelEmoji) {
    labelEmojiElement = `${missingEmojiPlaceholder} `;
  }

  if (isMe) {
    // No status for ourselves
  } else if (contact.isBlocked) {
    statusRow = (
      <div className="AboutContactModal__row">
        <i className="AboutContactModal__row__icon AboutContactModal__row__icon--blocked" />
        {i18n('icu:AboutContactModal__blocked', {
          name: contact.title,
        })}
      </div>
    );
  } else if (!contact.acceptedMessageRequest) {
    statusRow = (
      <div className="AboutContactModal__row">
        <i className="AboutContactModal__row__icon AboutContactModal__row__icon--message-request" />
        {i18n('icu:AboutContactModal__message-request')}
      </div>
    );
  } else if (!contact.hasMessages && !contact.profileSharing) {
    statusRow = (
      <div className="AboutContactModal__row">
        <i className="AboutContactModal__row__icon AboutContactModal__row__icon--no-dms" />
        {i18n('icu:AboutContactModal__no-dms', {
          name: contact.title,
        })}
      </div>
    );
  }

  const nameElement =
    canHaveNicknameAndNote(contact) &&
    contact.titleNoNickname !== contact.title &&
    contact.titleNoNickname ? (
      <span>
        <I18n
          i18n={i18n}
          id="icu:AboutContactModal__TitleAndTitleWithoutNickname"
          components={{
            nickname: <UserText text={contact.title} />,
            titleNoNickname: (
              <Tooltip
                className="AboutContactModal__TitleWithoutNickname__Tooltip"
                direction={TooltipPlacement.Top}
                content={
                  <I18n
                    i18n={i18n}
                    id="icu:AboutContactModal__TitleWithoutNickname__Tooltip"
                    components={{
                      title: <UserText text={contact.titleNoNickname} />,
                    }}
                  />
                }
                delay={0}
              >
                <UserText text={contact.titleNoNickname} />
              </Tooltip>
            ),
            muted,
          }}
        />
      </span>
    ) : (
      <UserText text={contact.title} />
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
          avatarPlaceholderGradient={contact.avatarPlaceholderGradient}
          avatarUrl={contact.avatarUrl}
          blur={avatarBlur}
          onClick={avatarOnClick}
          badge={undefined}
          color={contact.color}
          conversationType="direct"
          hasAvatar={contact.hasAvatar}
          i18n={i18n}
          loading={pendingAvatarDownload && !contact.avatarUrl}
          profileName={contact.profileName}
          size={AvatarSize.TWO_HUNDRED_SIXTEEN}
          title={contact.title}
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
        {isMe ? (
          <button
            className="AboutContactModal__button"
            type="button"
            onClick={showProfileEditor}
          >
            {nameElement}
          </button>
        ) : (
          nameElement
        )}
      </div>
      {!isMe && !fromOrAddedByTrustedContact ? (
        <div className="AboutContactModal__row">
          <i
            className={`AboutContactModal__row__icon AboutContactModal__row__icon--${contact.type === 'group' ? 'group' : 'direct'}-question`}
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
                contact.type === 'group'
                  ? 'icu:ConversationHero--group-names'
                  : 'icu:ConversationHero--profile-names'
              }
            />
          </button>
        </div>
      ) : null}
      {!isMe && contact.isVerified ? (
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
      {!isMe && contact.about ? (
        <div className="AboutContactModal__row">
          <i className="AboutContactModal__row__icon AboutContactModal__row__icon--about" />
          <About className="AboutContactModal__about" text={contact.about} />
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
      {!isMe && isInSystemContacts(contact) ? (
        <div className="AboutContactModal__row">
          <i className="AboutContactModal__row__icon AboutContactModal__row__icon--person" />
          {i18n('icu:AboutContactModal__system-contact', {
            name: contact.systemGivenName || contact.firstName || contact.title,
          })}
        </div>
      ) : null}

      {shouldShowLabel && (
        <div className="AboutContactModal__row">
          <i className="AboutContactModal__row__icon AboutContactModal__row__icon--label" />
          <button
            className="AboutContactModal__button"
            type="button"
            onClick={showEditMemberLabelScreen}
          >
            <div className="AboutContactModal__label-container">
              {labelEmojiElement}
              <span className="AboutContactModal__label-container__string">
                <UserText
                  fontSizeOverride={14}
                  style={{
                    verticalAlign: 'top',
                    marginTop: '3px',
                  }}
                  text={contactLabelString}
                />
              </span>
            </div>
          </button>
        </div>
      )}
      {shouldShowAddLabel && (
        <div className="AboutContactModal__row">
          <i className="AboutContactModal__row__icon AboutContactModal__row__icon--label" />
          <button
            className="AboutContactModal__button"
            type="button"
            onClick={showEditMemberLabelScreen}
          >
            {i18n('icu:AboutContactModal__add-member-label')}
          </button>
        </div>
      )}
      {isMe && contact.username && (
        <div className="AboutContactModal__row">
          <i className="AboutContactModal__row__icon AboutContactModal__row__icon--qr-code" />
          <button
            className="AboutContactModal__button"
            type="button"
            onClick={showQRCodeScreen}
          >
            {i18n('icu:AboutContactModal__your-qr-code')}
          </button>
        </div>
      )}

      {!isMe && contact.phoneNumber ? (
        <div className="AboutContactModal__row">
          <i className="AboutContactModal__row__icon AboutContactModal__row__icon--phone" />
          <UserText text={contact.phoneNumber} />
        </div>
      ) : null}

      {!isMe && (
        <div className="AboutContactModal__row">
          <i className="AboutContactModal__row__icon AboutContactModal__row__icon--group" />
          <div>
            <SharedGroupNames i18n={i18n} sharedGroupNames={sharedGroupNames} />
          </div>
        </div>
      )}
      {contact.note && (
        <div className="AboutContactModal__row">
          <i className="AboutContactModal__row__icon AboutContactModal__row__icon--note" />
          <button
            type="button"
            className="AboutContactModal__button"
            onClick={onOpenNotePreviewModal}
          >
            <div className="AboutContactModal__OneLineEllipsis">
              <UserText text={contact.note} />
            </div>
          </button>
        </div>
      )}
      {statusRow}
    </Modal>
  );
}

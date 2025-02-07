// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { useState } from 'react';

import { Avatar, AvatarSize } from '../../Avatar';
import { AvatarLightbox } from '../../AvatarLightbox';
import type { ConversationType } from '../../../state/ducks/conversations';
import { GroupDescription } from '../GroupDescription';
import { About } from '../About';
import type { LocalizerType, ThemeType } from '../../../types/Util';
import { assertDev } from '../../../util/assert';
import { BadgeDialog } from '../../BadgeDialog';
import type { BadgeType } from '../../../badges/types';
import { UserText } from '../../UserText';
import { isInSystemContacts } from '../../../util/isInSystemContacts';
import { InContactsIcon } from '../../InContactsIcon';

export type Props = {
  areWeASubscriber: boolean;
  badges?: ReadonlyArray<BadgeType>;
  canEdit: boolean;
  conversation: ConversationType;
  i18n: LocalizerType;
  isGroup: boolean;
  isMe: boolean;
  isSignalConversation: boolean;
  membersCount: number | null;
  startEditing: (isGroupTitle: boolean) => void;
  toggleAboutContactModal: (contactId: string) => void;
  theme: ThemeType;
};

enum ConversationDetailsHeaderActiveModal {
  ShowingAvatar,
  ShowingBadges,
}

export function ConversationDetailsHeader({
  areWeASubscriber,
  badges,
  canEdit,
  conversation,
  i18n,
  isGroup,
  isMe,
  isSignalConversation,
  membersCount,
  startEditing,
  toggleAboutContactModal,
  theme,
}: Props): JSX.Element {
  const [activeModal, setActiveModal] = useState<
    undefined | ConversationDetailsHeaderActiveModal
  >();

  let preferredBadge: undefined | BadgeType;
  let subtitle: ReactNode;
  let hasNestedButton = false;
  if (isGroup) {
    if (conversation.groupDescription) {
      subtitle = (
        <GroupDescription
          i18n={i18n}
          text={conversation.groupDescription}
          title={conversation.title}
        />
      );
      hasNestedButton = true;
    } else if (canEdit) {
      subtitle = i18n('icu:ConversationDetailsHeader--add-group-description');
    } else {
      subtitle = i18n('icu:ConversationDetailsHeader--members', {
        number: membersCount ?? 0,
      });
    }
  } else if (!isMe) {
    subtitle = (
      <div className="ConversationDetailsHeader__subtitle__about">
        <About text={conversation.about} />
      </div>
    );
    preferredBadge = badges?.[0];
  }

  const avatar = (
    <Avatar
      badge={preferredBadge}
      conversationType={conversation.type}
      i18n={i18n}
      size={AvatarSize.EIGHTY}
      {...conversation}
      noteToSelf={isMe}
      onClick={() => {
        setActiveModal(ConversationDetailsHeaderActiveModal.ShowingAvatar);
      }}
      onClickBadge={() => {
        setActiveModal(ConversationDetailsHeaderActiveModal.ShowingBadges);
      }}
      sharedGroupNames={[]}
      theme={theme}
    />
  );

  let modal: ReactNode;
  switch (activeModal) {
    case ConversationDetailsHeaderActiveModal.ShowingAvatar:
      modal = (
        <AvatarLightbox
          avatarColor={conversation.color}
          avatarUrl={conversation.avatarUrl}
          conversationTitle={conversation.title}
          i18n={i18n}
          isGroup={isGroup}
          noteToSelf={isMe}
          onClose={() => {
            setActiveModal(undefined);
          }}
        />
      );
      break;
    case ConversationDetailsHeaderActiveModal.ShowingBadges:
      modal = (
        <BadgeDialog
          areWeASubscriber={areWeASubscriber}
          badges={badges || []}
          firstName={conversation.firstName}
          i18n={i18n}
          onClose={() => {
            setActiveModal(undefined);
          }}
          title={conversation.title}
        />
      );
      break;
    default:
      modal = null;
      break;
  }

  if (canEdit) {
    assertDev(isGroup, 'Only groups support editable title');

    return (
      <div
        className="ConversationDetailsHeader"
        data-testid="ConversationDetailsHeader"
      >
        {modal}
        {avatar}
        <button
          type="button"
          onClick={ev => {
            ev.preventDefault();
            ev.stopPropagation();
            startEditing(true);
          }}
          className="ConversationDetailsHeader__edit-button"
        >
          <div className="ConversationDetailsHeader__title">
            <UserText text={conversation.title} />
          </div>
        </button>
        {hasNestedButton ? (
          <div className="ConversationDetailsHeader__subtitle">{subtitle}</div>
        ) : (
          <button
            type="button"
            onClick={ev => {
              if (ev.target instanceof HTMLAnchorElement) {
                return;
              }

              ev.preventDefault();
              ev.stopPropagation();
              startEditing(false);
            }}
            className="ConversationDetailsHeader__edit-button"
          >
            <div className="ConversationDetailsHeader__subtitle">
              {subtitle}
            </div>
          </button>
        )}
      </div>
    );
  }

  let title: JSX.Element;

  if (isMe) {
    title = (
      <div className="ConversationDetailsHeader__title">
        {i18n('icu:noteToSelf')}
        <span className="ContactModal__official-badge__large" />
      </div>
    );
  } else if (isSignalConversation) {
    title = (
      <div className="ConversationDetailsHeader__title">
        <UserText text={conversation.title} />
        <span className="ContactModal__official-badge__large" />
      </div>
    );
  } else if (isGroup) {
    title = (
      <div className="ConversationDetailsHeader__title">
        <UserText text={conversation.title} />
      </div>
    );
  } else {
    title = (
      <button
        type="button"
        onClick={ev => {
          ev.preventDefault();
          ev.stopPropagation();
          toggleAboutContactModal(conversation.id);
        }}
        className="ConversationDetailsHeader__about-button"
      >
        <div className="ConversationDetailsHeader__title">
          <UserText text={conversation.title} />
          {isInSystemContacts(conversation) && (
            <span>
              {' '}
              <InContactsIcon
                className="ConversationDetailsHeader__title-contact-icon"
                i18n={i18n}
              />
            </span>
          )}
          <span className="ConversationDetailsHeader__about-icon" />
        </div>
      </button>
    );
  }

  return (
    <div
      className="ConversationDetailsHeader"
      data-testid="ConversationDetailsHeader"
    >
      {modal}
      {avatar}
      {title}
      <div className="ConversationDetailsHeader__subtitle">{subtitle}</div>
    </div>
  );
}

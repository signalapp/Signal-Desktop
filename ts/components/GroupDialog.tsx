// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactChild, ReactNode } from 'react';
import React from 'react';

import type { LocalizerType, ThemeType } from '../types/Util.std.js';
import type { ConversationType } from '../state/ducks/conversations.preload.js';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges.preload.js';
import { ModalHost } from './ModalHost.dom.js';
import { Button, ButtonVariant } from './Button.dom.js';
import { Avatar, AvatarSize } from './Avatar.dom.js';
import { ContactName } from './conversation/ContactName.dom.js';

type PropsType = {
  children: ReactNode;
  i18n: LocalizerType;
  onClickPrimaryButton: () => void;
  onClose: () => void;
  primaryButtonText: string;
  title: string;
} & (
  | // We use this empty type for an "all or nothing" setup.
  // eslint-disable-next-line @typescript-eslint/ban-types
  {}
  | {
      onClickSecondaryButton: () => void;
      secondaryButtonText: string;
    }
);

// TODO: This should use <Modal>. See DESKTOP-1038.
export function GroupDialog(props: Readonly<PropsType>): JSX.Element {
  const {
    children,
    i18n,
    onClickPrimaryButton,
    onClose,
    primaryButtonText,
    title,
  } = props;

  let secondaryButton: undefined | ReactChild;
  if ('secondaryButtonText' in props) {
    const { onClickSecondaryButton, secondaryButtonText } = props;
    secondaryButton = (
      <Button
        onClick={onClickSecondaryButton}
        variant={ButtonVariant.Secondary}
      >
        {secondaryButtonText}
      </Button>
    );
  }

  return (
    <ModalHost modalName="GroupDialog" onClose={onClose}>
      <div className="module-GroupDialog">
        <button
          aria-label={i18n('icu:close')}
          type="button"
          className="module-GroupDialog__close-button"
          onClick={() => {
            onClose();
          }}
        />
        <h1 className="module-GroupDialog__title">{title}</h1>
        <div className="module-GroupDialog__body">{children}</div>
        <div className="module-GroupDialog__button-container">
          {secondaryButton}
          <Button
            onClick={onClickPrimaryButton}
            ref={focusRef}
            variant={ButtonVariant.Primary}
          >
            {primaryButtonText}
          </Button>
        </div>
      </div>
    </ModalHost>
  );
}

type ParagraphPropsType = {
  children: ReactNode;
};

function Paragraph({ children }: Readonly<ParagraphPropsType>): JSX.Element {
  return <p className="module-GroupDialog__paragraph">{children}</p>;
}

GroupDialog.Paragraph = Paragraph;

type ContactsPropsType = {
  contacts: Array<ConversationType>;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  theme: ThemeType;
};

function Contacts({
  contacts,
  getPreferredBadge,
  i18n,
  theme,
}: Readonly<ContactsPropsType>): JSX.Element {
  return (
    <ul className="module-GroupDialog__contacts">
      {contacts.map(contact => (
        <li key={contact.id} className="module-GroupDialog__contacts__contact">
          <Avatar
            avatarPlaceholderGradient={contact.avatarPlaceholderGradient}
            avatarUrl={contact.avatarUrl}
            badge={getPreferredBadge(contact.badges)}
            color={contact.color}
            conversationType={contact.type}
            hasAvatar={contact.hasAvatar}
            noteToSelf={contact.isMe}
            theme={theme}
            title={contact.title}
            sharedGroupNames={contact.sharedGroupNames}
            size={AvatarSize.TWENTY_EIGHT}
            i18n={i18n}
          />
          <ContactName
            module="module-GroupDialog__contacts__contact__name"
            title={contact.title}
          />
        </li>
      ))}
    </ul>
  );
}
GroupDialog.Contacts = Contacts;

function focusRef(el: HTMLElement | null) {
  if (el) {
    el.focus();
  }
}

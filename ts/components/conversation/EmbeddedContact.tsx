import React from 'react';
import classNames from 'classnames';

import { Avatar } from '../Avatar';
import { Contact, getName } from '../../types/Contact';

import { Localizer } from '../../types/Util';

interface Props {
  contact: Contact;
  hasSignalAccount: boolean;
  i18n: Localizer;
  isIncoming: boolean;
  withContentAbove: boolean;
  withContentBelow: boolean;
  onClick?: () => void;
}

export class EmbeddedContact extends React.Component<Props> {
  public render() {
    const {
      contact,
      i18n,
      isIncoming,
      onClick,
      withContentAbove,
      withContentBelow,
    } = this.props;
    const module = 'embedded-contact';

    return (
      <div
        className={classNames(
          'module-embedded-contact',
          withContentAbove
            ? 'module-embedded-contact--with-content-above'
            : null,
          withContentBelow
            ? 'module-embedded-contact--with-content-below'
            : null
        )}
        role="button"
        onClick={onClick}
      >
        {renderAvatar({ contact, i18n, size: 48 })}
        <div className="module-embedded-contact__text-container">
          {renderName({ contact, isIncoming, module })}
          {renderContactShorthand({ contact, isIncoming, module })}
        </div>
      </div>
    );
  }
}

// Note: putting these below the main component so style guide picks up EmbeddedContact

export function renderAvatar({
  contact,
  i18n,
  size,
}: {
  contact: Contact;
  i18n: Localizer;
  size: number;
}) {
  const { avatar } = contact;

  const avatarPath = avatar && avatar.avatar && avatar.avatar.path;
  const name = getName(contact) || '';

  return (
    <Avatar
      avatarPath={avatarPath}
      color="grey"
      conversationType="direct"
      i18n={i18n}
      name={name}
      size={size}
    />
  );
}

export function renderName({
  contact,
  isIncoming,
  module,
}: {
  contact: Contact;
  isIncoming: boolean;
  module: string;
}) {
  return (
    <div
      className={classNames(
        `module-${module}__contact-name`,
        isIncoming ? `module-${module}__contact-name--incoming` : null
      )}
    >
      {getName(contact)}
    </div>
  );
}

export function renderContactShorthand({
  contact,
  isIncoming,
  module,
}: {
  contact: Contact;
  isIncoming: boolean;
  module: string;
}) {
  const { number: phoneNumber, email } = contact;
  const firstNumber = phoneNumber && phoneNumber[0] && phoneNumber[0].value;
  const firstEmail = email && email[0] && email[0].value;

  return (
    <div
      className={classNames(
        `module-${module}__contact-method`,
        isIncoming ? `module-${module}__contact-method--incoming` : null
      )}
    >
      {firstNumber || firstEmail}
    </div>
  );
}

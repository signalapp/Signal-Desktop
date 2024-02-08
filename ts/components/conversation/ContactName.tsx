// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';

import { Emojify } from './Emojify';
import type { ContactNameColorType } from '../../types/Colors';
import { getClassNamesFor } from '../../util/getClassNamesFor';

export type PropsType = {
  contactNameColor?: ContactNameColorType;
  firstName?: string;
  isSignalConversation?: boolean;
  isMe?: boolean;
  module?: string;
  preferFirstName?: boolean;
  title: string;
  onClick?: VoidFunction;
};

export function ContactName({
  contactNameColor,
  firstName,
  isSignalConversation,
  isMe,
  module,
  preferFirstName,
  title,
  onClick,
}: PropsType): JSX.Element {
  const getClassName = getClassNamesFor('module-contact-name', module);

  let text: string;
  if (preferFirstName) {
    text = firstName || title || '';
  } else {
    text = title || '';
  }
  const WrappingElement = onClick ? 'button' : 'span';
  return (
    <WrappingElement
      className={classNames(
        getClassName(''),
        contactNameColor ? getClassName(`--${contactNameColor}`) : null
      )}
      dir="auto"
      onClick={onClick}
    >
      <Emojify text={text} />
      {(isSignalConversation || isMe) && (
        <span className="ContactModal__official-badge" />
      )}
    </WrappingElement>
  );
}

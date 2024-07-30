// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useMemo } from 'react';
import classNames from 'classnames';

import { Emojify } from './Emojify';
import type { ContactNameColorType } from '../../types/Colors';
import { getClassNamesFor } from '../../util/getClassNamesFor';
import type { ConversationType } from '../../state/ducks/conversations';
import { isSignalConversation as getIsSignalConversation } from '../../util/isSignalConversation';

export type ContactNameData = {
  contactNameColor?: ContactNameColorType;
  firstName?: string;
  isSignalConversation?: boolean;
  isMe?: boolean;
  title: string;
};

export function useContactNameData(
  conversation: ConversationType | null,
  contactNameColor?: ContactNameColorType
): ContactNameData | null {
  const { firstName, title, isMe } = conversation ?? {};
  const isSignalConversation =
    conversation != null ? getIsSignalConversation(conversation) : null;
  return useMemo(() => {
    if (title == null || isSignalConversation == null) {
      return null;
    }
    return {
      contactNameColor,
      firstName,
      isSignalConversation,
      isMe,
      title,
    };
  }, [contactNameColor, firstName, isSignalConversation, isMe, title]);
}

export type PropsType = ContactNameData & {
  module?: string;
  preferFirstName?: boolean;
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

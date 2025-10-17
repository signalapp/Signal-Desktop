// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useMemo } from 'react';
import classNames from 'classnames';

import { Emojify } from './Emojify.dom.js';
import type { ContactNameColorType } from '../../types/Colors.std.js';
import { getClassNamesFor } from '../../util/getClassNamesFor.std.js';
import type { ConversationType } from '../../state/ducks/conversations.preload.js';
import { isSignalConversation as getIsSignalConversation } from '../../util/isSignalConversation.dom.js';

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
  largeVerifiedBadge?: boolean;
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
  largeVerifiedBadge,
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
        <span
          className={
            largeVerifiedBadge
              ? 'ContactModal__official-badge__large'
              : 'ContactModal__official-badge'
          }
        />
      )}
    </WrappingElement>
  );
}

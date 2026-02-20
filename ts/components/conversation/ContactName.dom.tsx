// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useMemo } from 'react';
import classNames from 'classnames';

import type { ReactNode } from 'react';

import { getClassNamesFor } from '../../util/getClassNamesFor.std.js';
import { isSignalConversation as getIsSignalConversation } from '../../util/isSignalConversation.dom.js';
import {
  getEmojiVariantByKey,
  getEmojiVariantKeyByValue,
  isEmojiVariantValue,
} from '../fun/data/emojis.std.js';
import { useFunEmojiLocalizer } from '../fun/useFunEmojiLocalizer.dom.js';
import { FunStaticEmoji } from '../fun/FunEmoji.dom.js';
import { missingEmojiPlaceholder } from '../../types/GroupMemberLabels.std.js';

import type { MemberLabelType } from '../../types/GroupMemberLabels.std.js';
import type { ConversationType } from '../../state/ducks/conversations.preload.js';
import type { ContactNameColorType } from '../../types/Colors.std.js';
import type { FunStaticEmojiSize } from '../fun/FunEmoji.dom.js';
import { UserText } from '../UserText.dom.js';

export type ContactNameData = {
  contactNameColor?: ContactNameColorType;
  contactLabel?: { labelString: string; labelEmoji: string | undefined };
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
  fontSizeOverride?: number;
  module?: string;
  preferFirstName?: boolean;
  onClick?: VoidFunction;
  largeVerifiedBadge?: boolean;
};

export function ContactName({
  contactLabel,
  contactNameColor,
  firstName,
  isSignalConversation,
  isMe,
  module,
  preferFirstName,
  title,
  onClick,
  largeVerifiedBadge,
}: PropsType): React.JSX.Element {
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
      <UserText text={text} />
      {(isSignalConversation || isMe) && (
        <span
          className={
            largeVerifiedBadge
              ? 'ContactModal__official-badge__large'
              : 'ContactModal__official-badge'
          }
        />
      )}
      {contactLabel && (
        <>
          {' '}
          <GroupMemberLabel
            contactLabel={contactLabel}
            context="bubble"
            contactNameColor={contactNameColor}
          />
        </>
      )}
    </WrappingElement>
  );
}

export type Context = 'bubble' | 'list' | 'quote' | 'contact-modal';

export function GroupMemberLabel({
  emojiSize = 12,
  contactLabel,
  contactNameColor,
  context,
  module,
}: {
  emojiSize?: FunStaticEmojiSize;
  contactLabel?: MemberLabelType;
  contactNameColor?: ContactNameColorType;
  context: Context;
  module?: string;
}): ReactNode {
  const emojiLocalizer = useFunEmojiLocalizer();
  const getClassName = getClassNamesFor('module-contact-name', module);

  if (!contactLabel) {
    return null;
  }

  const { labelEmoji, labelString } = contactLabel;

  let emojiElement;
  if (labelEmoji && isEmojiVariantValue(labelEmoji)) {
    const emojiKey = getEmojiVariantKeyByValue(labelEmoji);
    const emojiData = getEmojiVariantByKey(emojiKey);

    emojiElement = (
      <span
        className={classNames(
          getClassName('--label-pill--emoji'),
          getClassName(`--label-pill--${context}--emoji`)
        )}
      >
        <FunStaticEmoji
          role="img"
          aria-label={emojiLocalizer.getLocaleShortName(emojiData.key)}
          size={emojiSize}
          emoji={emojiData}
        />
      </span>
    );
  } else if (labelEmoji) {
    emojiElement = (
      <span
        className={classNames(
          getClassName('--label-pill--emoji'),
          getClassName(`--label-pill--${context}--emoji`)
        )}
      >
        {missingEmojiPlaceholder}
      </span>
    );
  }

  return (
    <span
      className={classNames(
        getClassName('--label-pill'),
        getClassName(`--label-pill--${context}`),
        getClassName(`--${contactNameColor}--label-pill--${context}`)
      )}
    >
      <span
        className={classNames(
          getClassName('--label-pill--inner'),
          getClassName(`--label-pill--inner--${context}`)
        )}
      >
        {emojiElement}
        <span
          className={classNames(
            getClassName('--label-pill--text'),
            getClassName(`--label-pill--${context}--text`)
          )}
        >
          <UserText
            fontSizeOverride={emojiSize}
            style={{
              verticalAlign: 'top',
              marginTop: emojiSize / 6,
            }}
            text={labelString}
          />
        </span>
      </span>
    </span>
  );
}

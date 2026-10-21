// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo } from 'react';
import classNames from 'classnames';

import type { ReactNode, JSX, MouseEvent } from 'react';

import { isSignalConversation as getIsSignalConversation } from '../../util/isSignalConversation.dom.ts';
import { FunStaticEmoji } from '../fun/FunEmoji.dom.tsx';
import { missingEmojiPlaceholder } from '../../types/GroupMemberLabels.std.ts';

import type { MemberLabelType } from '../../types/GroupMemberLabels.std.ts';
import type { ConversationType } from '../../state/ducks/conversations.preload.ts';
import type { ContactNameColorType } from '../../types/ContactNameColor.std.ts';
import type { FunStaticEmojiSize } from '../fun/FunEmoji.dom.tsx';
import { UserText } from '../UserText.dom.tsx';
import { OfficialChatInlineBadge } from './OfficialChatInlineBadge.dom.tsx';
import { Emoji } from '../../axo/emoji.std.ts';
import { AxoTokens } from '../../axo/AxoTokens.std.ts';

export type ContactNameData = {
  contactNameColor?: ContactNameColorType;
  contactLabel?: { labelString: string; labelEmoji: Emoji.Variant | undefined };
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
  /** @deprecated */
  className?: string;
  preferFirstName?: boolean;
  onClick?: VoidFunction;
};

export function ContactName({
  contactLabel,
  contactNameColor,
  firstName,
  isSignalConversation,
  isMe,
  className,
  preferFirstName,
  title,
  onClick,
}: PropsType): JSX.Element {
  let text: string;
  if (preferFirstName) {
    text = firstName || title || '';
  } else {
    text = title || '';
  }
  const WrappingElement = onClick ? 'button' : 'span';

  const values =
    contactNameColor != null
      ? AxoTokens.Contact.getColorValues(contactNameColor)
      : null;

  const style = {
    '--contact-name-color-light': values?.light,
    '--contact-name-color-dark': values?.dark,
  };

  return (
    <WrappingElement
      className={classNames('module-contact-name', className)}
      style={style}
      dir="auto"
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        if (onClick) {
          onClick();
          event.stopPropagation();
          event.preventDefault();
        }
      }}
    >
      <UserText text={text} />

      {(isSignalConversation || isMe) && (
        <>
          &nbsp;
          <OfficialChatInlineBadge />
        </>
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

const CONTEXTS: Record<Context, string> = {
  bubble: 'module-contact-name--label-pill--bubble',
  list: 'module-contact-name--label-pill--list',
  quote: 'module-contact-name--label-pill--quote',
  'contact-modal': 'module-contact-name--label-pill--contact-modal',
};

export function GroupMemberLabel({
  emojiSize = 12,
  contactLabel,
  contactNameColor,
  context,
}: {
  emojiSize?: FunStaticEmojiSize;
  contactLabel?: MemberLabelType;
  contactNameColor?: ContactNameColorType;
  context: Context;
}): ReactNode {
  if (!contactLabel) {
    return null;
  }

  const { labelEmoji, labelString } = contactLabel;

  let emojiElement;
  if (labelEmoji && Emoji.isEmoji(labelEmoji)) {
    emojiElement = (
      <span className="module-contact-name--label-pill--emoji">
        <FunStaticEmoji
          role="img"
          aria-label={Emoji.getDisplayLabel(labelEmoji)}
          size={emojiSize}
          emoji={Emoji.ignorePreferredSkinTone(labelEmoji)}
        />
      </span>
    );
  } else if (labelEmoji) {
    emojiElement = (
      <span className="module-contact-name--label-pill--emoji">
        {missingEmojiPlaceholder}
      </span>
    );
  }

  const values =
    contactNameColor != null
      ? AxoTokens.Contact.getColorValues(contactNameColor)
      : null;

  const style = {
    '--contact-name-color-light': values?.light,
    '--contact-name-color-dark': values?.dark,
  };

  return (
    <span
      className={classNames(
        'module-contact-name--label-pill',
        CONTEXTS[context]
      )}
      style={style}
    >
      <span className="module-contact-name--label-pill--inner">
        {emojiElement}
        <span className="module-contact-name--label-pill--text">
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

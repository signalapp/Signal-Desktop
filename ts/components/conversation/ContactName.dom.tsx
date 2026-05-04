// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo } from 'react';
import classNames from 'classnames';

import type { ReactNode, JSX, MouseEvent } from 'react';

import { getClassNamesFor } from '../../util/getClassNamesFor.std.ts';
import { isSignalConversation as getIsSignalConversation } from '../../util/isSignalConversation.dom.ts';
import { FunStaticEmoji } from '../fun/FunEmoji.dom.tsx';
import { missingEmojiPlaceholder } from '../../types/GroupMemberLabels.std.ts';

import type { MemberLabelType } from '../../types/GroupMemberLabels.std.ts';
import type { ConversationType } from '../../state/ducks/conversations.preload.ts';
import type { ContactNameColorType } from '../../types/Colors.std.ts';
import type { FunStaticEmojiSize } from '../fun/FunEmoji.dom.tsx';
import { UserText } from '../UserText.dom.tsx';
import { OfficialChatInlineBadge } from './OfficialChatInlineBadge.dom.tsx';
import { Emoji } from '../../axo/emoji.std.ts';

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
  module?: string;
  preferFirstName?: boolean;
  onClick?: VoidFunction;
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
  const getClassName = getClassNamesFor('module-contact-name', module);

  if (!contactLabel) {
    return null;
  }

  const { labelEmoji, labelString } = contactLabel;

  let emojiElement;
  if (labelEmoji && Emoji.isEmoji(labelEmoji)) {
    emojiElement = (
      <span
        className={classNames(
          getClassName('--label-pill--emoji'),
          getClassName(`--label-pill--${context}--emoji`)
        )}
      >
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

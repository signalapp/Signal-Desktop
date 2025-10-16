// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useRef, useEffect } from 'react';
import type { LocalizerType } from '../types/Util.std.js';
import { AvatarColors } from '../types/Colors.std.js';
import { Avatar, AvatarSize } from './Avatar.dom.js';
import { I18n } from './I18n.dom.js';
import { ContactName } from './conversation/ContactName.dom.js';
import type { ConversationType } from '../state/ducks/conversations.preload.js';

export type Props = {
  conversation: Pick<
    ConversationType,
    | 'avatarPlaceholderGradient'
    | 'acceptedMessageRequest'
    | 'avatarUrl'
    | 'color'
    | 'hasAvatar'
    | 'isMe'
    | 'name'
    | 'phoneNumber'
    | 'profileName'
    | 'sharedGroupNames'
    | 'title'
  >;
  i18n: LocalizerType;
  close: () => void;
};

const AUTO_CLOSE_MS = 10000;

export function CallNeedPermissionScreen({
  conversation,
  i18n,
  close,
}: Props): JSX.Element {
  const title = conversation.title || i18n('icu:unknownContact');

  const autoCloseAtRef = useRef<number>(Date.now() + AUTO_CLOSE_MS);
  useEffect(() => {
    const timeout = setTimeout(close, autoCloseAtRef.current - Date.now());
    return clearTimeout.bind(null, timeout);
  }, [autoCloseAtRef, close]);

  return (
    <div className="module-call-need-permission-screen">
      <Avatar
        avatarPlaceholderGradient={conversation.avatarPlaceholderGradient}
        avatarUrl={conversation.avatarUrl}
        badge={undefined}
        color={conversation.color || AvatarColors[0]}
        noteToSelf={false}
        conversationType="direct"
        hasAvatar={conversation.hasAvatar}
        i18n={i18n}
        phoneNumber={conversation.phoneNumber}
        profileName={conversation.profileName}
        title={conversation.title}
        sharedGroupNames={conversation.sharedGroupNames}
        size={AvatarSize.EIGHTY}
      />

      <p className="module-call-need-permission-screen__text">
        <I18n
          i18n={i18n}
          id="icu:callNeedPermission"
          components={{
            title: <ContactName title={title} />,
          }}
        />
      </p>

      <button
        type="button"
        className="module-call-need-permission-screen__button"
        onClick={() => {
          close();
        }}
      >
        {i18n('icu:close')}
      </button>
    </div>
  );
}

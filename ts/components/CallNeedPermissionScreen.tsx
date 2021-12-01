// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useRef, useEffect } from 'react';
import type { LocalizerType } from '../types/Util';
import { AvatarColors } from '../types/Colors';
import { Avatar } from './Avatar';
import { Intl } from './Intl';
import { ContactName } from './conversation/ContactName';
import type { ConversationType } from '../state/ducks/conversations';

type Props = {
  conversation: Pick<
    ConversationType,
    | 'acceptedMessageRequest'
    | 'avatarPath'
    | 'color'
    | 'isMe'
    | 'name'
    | 'phoneNumber'
    | 'profileName'
    | 'sharedGroupNames'
    | 'title'
    | 'unblurredAvatarPath'
  >;
  i18n: LocalizerType;
  close: () => void;
};

const AUTO_CLOSE_MS = 10000;

export const CallNeedPermissionScreen: React.FC<Props> = ({
  conversation,
  i18n,
  close,
}) => {
  const title = conversation.title || i18n('unknownContact');

  const autoCloseAtRef = useRef<number>(Date.now() + AUTO_CLOSE_MS);
  useEffect(() => {
    const timeout = setTimeout(close, autoCloseAtRef.current - Date.now());
    return clearTimeout.bind(null, timeout);
  }, [autoCloseAtRef, close]);

  return (
    <div className="module-call-need-permission-screen">
      <Avatar
        acceptedMessageRequest={conversation.acceptedMessageRequest}
        avatarPath={conversation.avatarPath}
        badge={undefined}
        color={conversation.color || AvatarColors[0]}
        noteToSelf={false}
        conversationType="direct"
        i18n={i18n}
        isMe={conversation.isMe}
        name={conversation.name}
        phoneNumber={conversation.phoneNumber}
        profileName={conversation.profileName}
        title={conversation.title}
        sharedGroupNames={conversation.sharedGroupNames}
        size={112}
      />

      <p className="module-call-need-permission-screen__text">
        <Intl
          i18n={i18n}
          id="callNeedPermission"
          components={[<ContactName title={title} />]}
        />
      </p>

      <button
        type="button"
        className="module-call-need-permission-screen__button"
        onClick={() => {
          close();
        }}
      >
        {i18n('close')}
      </button>
    </div>
  );
};

// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useRef, useEffect } from 'react';
import { LocalizerType } from '../types/Util';
import { Avatar } from './Avatar';
import { Intl } from './Intl';
import { ContactName } from './conversation/ContactName';
import { ColorType } from '../types/Colors';

interface Props {
  conversation: {
    avatarPath?: string;
    color?: ColorType;
    name?: string;
    phoneNumber?: string;
    profileName?: string;
    title: string;
  };
  i18n: LocalizerType;
  close: () => void;
}

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
        avatarPath={conversation.avatarPath}
        color={conversation.color || 'ultramarine'}
        noteToSelf={false}
        conversationType="direct"
        i18n={i18n}
        name={conversation.name}
        phoneNumber={conversation.phoneNumber}
        profileName={conversation.profileName}
        title={conversation.title}
        size={112}
      />

      <p className="module-call-need-permission-screen__text">
        <Intl
          i18n={i18n}
          id="callNeedPermission"
          components={[<ContactName i18n={i18n} title={title} />]}
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

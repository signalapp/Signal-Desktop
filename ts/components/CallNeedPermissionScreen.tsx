import React, { useRef, useEffect } from 'react';
import { CallDetailsType } from '../state/ducks/calling';
import { LocalizerType } from '../types/Util';
import { Avatar } from './Avatar';
import { Intl } from './Intl';
import { ContactName } from './conversation/ContactName';

interface Props {
  callDetails: CallDetailsType;
  i18n: LocalizerType;
  close: () => void;
}

const AUTO_CLOSE_MS = 10000;

export const CallNeedPermissionScreen: React.FC<Props> = ({
  callDetails,
  i18n,
  close,
}) => {
  const title = callDetails.title || i18n('unknownContact');

  const autoCloseAtRef = useRef<number>(Date.now() + AUTO_CLOSE_MS);
  useEffect(() => {
    const timeout = setTimeout(close, autoCloseAtRef.current - Date.now());
    return clearTimeout.bind(null, timeout);
  }, [autoCloseAtRef, close]);

  return (
    <div className="module-call-need-permission-screen">
      <Avatar
        avatarPath={callDetails.avatarPath}
        color={callDetails.color || 'ultramarine'}
        noteToSelf={false}
        conversationType="direct"
        i18n={i18n}
        name={callDetails.name}
        phoneNumber={callDetails.phoneNumber}
        profileName={callDetails.profileName}
        title={callDetails.title}
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

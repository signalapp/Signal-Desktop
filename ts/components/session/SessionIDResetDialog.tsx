import React, { useState } from 'react';

import { SessionModal } from './SessionModal';
import { SessionButton, SessionButtonColor } from './SessionButton';
import { DefaultTheme, withTheme } from 'styled-components';
import {
  SessionIcon,
  SessionIconButton,
  SessionIconSize,
  SessionIconType,
} from './icon';

type Props = {
  onClose: any;
  theme: DefaultTheme;
};
/* tslint:disable:use-simple-attributes */

const SessionIDResetDialogInner = (props: Props) => {
  const [firstScreen, setFirstScreen] = useState(true);

  const descFirst =
    'We’ve upgraded Session IDs to make them even more private and secure. We recommend upgrading to a new Session ID now.\n\n\
  You will lose existing contacts and conversations, but you’ll gain even more privacy and security. You will need to upgrade your Session ID eventually, but you can choose to delay the upgrade if you need to save contacts or conversations.';

  const descSecond =
    'You’re upgrading to a new Session ID. This will give you improved privacy and security, but it will clear ALL app data. Contacts and conversations will be lost. Proceed?';
  return (
    <SessionModal
      title={
        (firstScreen && 'Session IDs Just Got Better') || 'Upgrade Session ID?'
      }
      onOk={() => null}
      onClose={props.onClose}
      theme={props.theme}
    >
      <div className="spacer-sm" />
      <div className="session-modal__centered text-center">
        {firstScreen && (
          <SessionIcon
            iconType={SessionIconType.Shield}
            iconSize={SessionIconSize.Max}
            theme={props.theme}
          />
        )}
        <div className="spacer-lg" />

        {(firstScreen && descFirst) || descSecond}

        <div className="spacer-xs" />
      </div>
      <div className="spacer-lg" />

      <div className="session-modal__button-group">
        <SessionButton
          text={(firstScreen && 'Upgrade Now') || window.i18n('ok')}
          onClick={() => {
            if (firstScreen) {
              setFirstScreen(false);
            } else {
              window.deleteAccount('Session ID Upgrade');
              props.onClose();
            }
          }}
          buttonColor={SessionButtonColor.Danger}
        />
        <SessionButton
          text={(firstScreen && 'Upgrade Later') || window.i18n('cancel')}
          onClick={() => {
            props.onClose();
          }}
        />
      </div>
    </SessionModal>
  );
};

export const SessionIDResetDialog = withTheme(SessionIDResetDialogInner);

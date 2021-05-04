import React from 'react';

import { SessionModal } from './SessionModal';
import { SessionButton, SessionButtonColor } from './SessionButton';
import { DefaultTheme, withTheme } from 'styled-components';
import { SessionIcon, SessionIconSize, SessionIconType } from './icon';
import { deleteAccount } from '../../util/accountManager';

type Props = {
  onClose: any;
  theme: DefaultTheme;
};
/* tslint:disable:use-simple-attributes */

const SessionIDResetDialogInner = (props: Props) => {
  const description =
    'We’ve upgraded Session IDs to make them even more private and secure. To ensure your continued privacy you are now required to upgrade.\n\n\
    Your existing contacts and conversations will be lost, but you’ll be able to use Session knowing you have the best privacy and security possible.';

  return (
    <SessionModal title="Mandatory Upgrade Session ID" onClose={() => null} theme={props.theme}>
      <div className="spacer-sm" />
      <div className="session-modal__centered text-center">
        <SessionIcon
          iconType={SessionIconType.Shield}
          iconSize={SessionIconSize.Max}
          theme={props.theme}
        />
        <div className="spacer-lg" />

        {description}
        <div className="spacer-xs" />
      </div>
      <div className="spacer-lg" />

      <div className="session-modal__button-group">
        <SessionButton
          text="Upgrade Now"
          onClick={() => {
            void deleteAccount('Session ID Upgrade');
            props.onClose();
          }}
          buttonColor={SessionButtonColor.Danger}
        />
      </div>
    </SessionModal>
  );
};

export const SessionIDResetDialog = withTheme(SessionIDResetDialogInner);

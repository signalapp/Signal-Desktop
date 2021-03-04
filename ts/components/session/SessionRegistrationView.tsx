import React, { useEffect } from 'react';
import { AccentText } from './AccentText';

import { RegistrationTabs } from './registration/RegistrationTabs';
import { SessionIconButton, SessionIconSize, SessionIconType } from './icon';
import { SessionToastContainer } from './SessionToastContainer';
import { lightTheme, SessionTheme } from '../../state/ducks/SessionTheme';
import { setSignInByLinking } from '../../session/utils/User';

export const SessionRegistrationView = () => {
  useEffect(() => {
    setSignInByLinking(false);
  }, []);
  return (
    <SessionTheme theme={lightTheme}>
      <div className="session-content">
        <SessionToastContainer theme={lightTheme} />
        <div id="error" className="collapse" />
        <div className="session-content-header">
          <div className="session-content-close-button">
            <SessionIconButton
              iconSize={SessionIconSize.Medium}
              iconType={SessionIconType.Exit}
              onClick={() => {
                window.close();
              }}
              theme={lightTheme}
            />
          </div>
          <div className="session-content-session-button">
            <img alt="brand" src="./images/session/brand.svg" />
          </div>
        </div>
        <div className="session-content-body">
          <div className="session-content-accent">
            <AccentText />
          </div>
          <div className="session-content-registration">
            <RegistrationTabs theme={lightTheme} />
          </div>
        </div>
      </div>
    </SessionTheme>
  );
};

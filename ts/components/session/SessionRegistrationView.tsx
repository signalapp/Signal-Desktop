import React from 'react';
import { AccentText } from './AccentText';

import { RegistrationTabs } from './RegistrationTabs';
import { SessionIconButton, SessionIconSize, SessionIconType } from './icon';

export const SessionRegistrationView: React.FC = () => (
  <div className="session-content">
    <div id="session-toast-container" />
    <div id="error" className="collapse" />
    <div className="session-content-close-button">
      <SessionIconButton
        iconSize={SessionIconSize.Medium}
        iconType={SessionIconType.Exit}
        onClick={() => {
          window.close();
        }}
      />
    </div>

    <div className="session-content-accent">
      <AccentText />
    </div>
    <div className="session-content-registration">
      <RegistrationTabs />
    </div>
    <div className="session-content-session-button">
      <img alt="brand" src="./images/session/brand.svg" />
    </div>
  </div>
);

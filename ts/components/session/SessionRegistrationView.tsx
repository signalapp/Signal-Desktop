import React from 'react';
import { AccentText } from './AccentText';

import { RegistrationTabs } from './RegistrationTabs';

export const SessionRegistrationView: React.FC = () => (
  <div className="session-content">
    <div id="error" className="collapse" />
    <div className="session-content-accent">
      <AccentText />
    </div>
    <div className="session-content-registration">
      <RegistrationTabs />
    </div>
  </div>
);

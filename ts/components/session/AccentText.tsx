import React from 'react';

import { SessionHtmlRenderer } from './SessionHTMLRenderer';

export const AccentText: React.FC = () => (
  <div className="session-content-accent-text">
    <div className="session-content-accent-text title">
      <SessionHtmlRenderer html={window.i18n('beginYourSession')} />
    </div>
  </div>
);

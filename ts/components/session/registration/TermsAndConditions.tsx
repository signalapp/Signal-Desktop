import React from 'react';
import { SessionHtmlRenderer } from '../SessionHTMLRenderer';

export const TermsAndConditions = () => {
  return (
    <div className="session-terms-conditions-agreement">
      <SessionHtmlRenderer html={window.i18n('ByUsingThisService...')} />
    </div>
  );
};

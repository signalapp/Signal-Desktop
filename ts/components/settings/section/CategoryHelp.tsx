import { ipcRenderer, shell } from 'electron';
import React from 'react';
import { SessionButtonShape, SessionButtonType } from '../../basic/SessionButton';

import { SessionSettingButtonItem, SessionSettingsTitleWithLink } from '../SessionSettingListItem';

export const SettingsCategoryHelp = () => {
  return (
    <>
      <SessionSettingButtonItem
        onClick={() => {
          ipcRenderer.send('show-debug-log');
        }}
        buttonShape={SessionButtonShape.Square}
        buttonType={SessionButtonType.Solid}
        buttonText={window.i18n('showDebugLog')}
        title={window.i18n('reportIssue')}
        description={window.i18n('shareBugDetails')}
      />
      <SessionSettingsTitleWithLink
        title={window.i18n('surveyTitle')}
        onClick={() => void shell.openExternal('https://getsession.org/survey')}
      />
      <SessionSettingsTitleWithLink
        title={window.i18n('helpUsTranslateSession')}
        onClick={() => void shell.openExternal('https://crowdin.com/project/session-desktop/')}
      />
      <SessionSettingsTitleWithLink
        title={window.i18n('faq')}
        onClick={() => void shell.openExternal('https://getsession.org/faq')}
      />
      <SessionSettingsTitleWithLink
        title={window.i18n('support')}
        onClick={() => void shell.openExternal('https://sessionapp.zendesk.com/hc/en-us')}
      />
    </>
  );
};

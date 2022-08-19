import { ipcRenderer, shell } from 'electron';
import React from 'react';
import { SessionButtonColor } from '../../basic/SessionButton';

import { SessionSettingButtonItem } from '../SessionSettingListItem';

export const SettingsCategoryHelp = (props: { hasPassword: boolean | null }) => {
  if (props.hasPassword !== null) {
    return (
      <>
        <SessionSettingButtonItem
          title={window.i18n('surveyTitle')}
          onClick={() => void shell.openExternal('https://getsession.org/survey')}
          buttonColor={SessionButtonColor.Primary}
          buttonText={window.i18n('goToOurSurvey')}
        />
        <SessionSettingButtonItem
          title={window.i18n('helpUsTranslateSession')}
          onClick={() => void shell.openExternal('https://crowdin.com/project/session-desktop/')}
          buttonColor={SessionButtonColor.Primary}
          buttonText={window.i18n('translation')}
        />
        <SessionSettingButtonItem
          onClick={() => {
            ipcRenderer.send('show-debug-log');
          }}
          buttonColor={SessionButtonColor.Primary}
          buttonText={window.i18n('showDebugLog')}
        />
      </>
    );
  }
  return null;
};

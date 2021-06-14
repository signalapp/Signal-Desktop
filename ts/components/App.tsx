import React from 'react';
import classNames from 'classnames';

import { AppViewType } from '../state/ducks/app';
import { Inbox } from './Inbox';
import { Install } from './Install';
import { StandaloneRegistration } from './StandaloneRegistration';
import { ThemeType } from '../types/Util';

export type PropsType = {
  appView: AppViewType;
  hasInitialLoadCompleted: boolean;
  theme: ThemeType;
};

export const App = ({
  appView,
  hasInitialLoadCompleted,
  theme,
}: PropsType): JSX.Element => {
  let contents;

  if (appView === AppViewType.Installer) {
    contents = <Install />;
  } else if (appView === AppViewType.Standalone) {
    contents = <StandaloneRegistration />;
  } else if (appView === AppViewType.Inbox) {
    contents = <Inbox hasInitialLoadCompleted={hasInitialLoadCompleted} />;
  }

  return (
    <div
      className={classNames({
        App: true,
        'light-theme': theme === ThemeType.light,
        'dark-theme': theme === ThemeType.dark,
      })}
    >
      {contents}
    </div>
  );
};

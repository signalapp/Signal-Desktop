import React, { useEffect } from 'react';
import classNames from 'classnames';

import { AppViewType } from '../state/ducks/app';
import { Inbox } from './Inbox';
import { Install } from './Install';
import { StandaloneRegistration } from './StandaloneRegistration';
import { ThemeType } from '../types/Util';

export type PropsType = {
  appView: AppViewType;
  hasInitialLoadCompleted: boolean;
  renderCallManager: () => JSX.Element;
  renderGlobalModalContainer: () => JSX.Element;
  theme: ThemeType;
};

export const App = ({
  appView,
  hasInitialLoadCompleted,
  renderCallManager,
  renderGlobalModalContainer,
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

  // This is here so that themes are properly applied to anything that is
  // created in a portal and exists outside of the <App /> container.
  useEffect(() => {
    document.body.classList.remove('light-theme');
    document.body.classList.remove('dark-theme');

    if (theme === ThemeType.dark) {
      document.body.classList.add('dark-theme');
    }
    if (theme === ThemeType.light) {
      document.body.classList.add('light-theme');
    }
  }, [theme]);

  return (
    <div
      className={classNames({
        App: true,
        'light-theme': theme === ThemeType.light,
        'dark-theme': theme === ThemeType.dark,
      })}
    >
      {renderGlobalModalContainer()}
      {renderCallManager()}
      {contents}
    </div>
  );
};

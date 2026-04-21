// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect } from 'react';
import classNames from 'classnames';

import { AppViewType } from '../types/app.std.ts';
import { missingCaseError } from '../util/missingCaseError.std.ts';
import { usePageVisibility } from '../hooks/usePageVisibility.dom.ts';
import { TitlebarDragArea } from './TitlebarDragArea.dom.tsx';
import { ThemeType } from '../types/Util.std.ts';

import type { ViewStoryActionCreatorType } from '../state/ducks/stories.preload.ts';
import type { AppStateType } from '../state/ducks/app.preload.ts';

type PropsType = {
  state: AppStateType;
  renderCallManager: () => React.JSX.Element;
  renderGlobalModalContainer: () => React.JSX.Element;
  hasSelectedStoryData: boolean;
  renderStandaloneRegistration: () => React.JSX.Element;
  renderStoryViewer: (closeView: () => unknown) => React.JSX.Element;
  renderInstallScreen: () => React.JSX.Element;
  renderLightbox: () => React.JSX.Element | null;
  theme: ThemeType;
  isMaximized: boolean;
  isFullScreen: boolean;
  osClassName: string;

  scrollToMessage: (conversationId: string, messageId: string) => unknown;
  viewStory: ViewStoryActionCreatorType;
  renderInbox: () => React.JSX.Element;
};

export function App({
  state,
  hasSelectedStoryData,
  isFullScreen,
  isMaximized,
  osClassName,
  renderCallManager,
  renderGlobalModalContainer,
  renderInbox,
  renderInstallScreen,
  renderLightbox,
  renderStandaloneRegistration,
  renderStoryViewer,
  theme,
  viewStory,
}: PropsType): React.JSX.Element {
  let contents;

  if (state.appView === AppViewType.Installer) {
    contents = renderInstallScreen();
  } else if (state.appView === AppViewType.Standalone) {
    contents = renderStandaloneRegistration();
  } else if (state.appView === AppViewType.Inbox) {
    contents = renderInbox();
  } else if (state.appView === AppViewType.Blank) {
    // See `background.html`
    contents = (
      <div className="app-loading-screen app-loading-screen--before-app-load">
        <TitlebarDragArea />

        <div className="module-splash-screen__logo module-splash-screen__logo--128" />
        <div className="dot-container">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </div>
        <div className="message-placeholder" />
      </div>
    );
  } else {
    throw missingCaseError(state.appView);
  }

  // This are here so that themes are properly applied to anything that is
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

  useEffect(() => {
    document.body.classList.add(osClassName);
  }, [osClassName]);

  useEffect(() => {
    document.body.classList.toggle('full-screen', isFullScreen);
    document.body.classList.toggle('maximized', isMaximized);
  }, [isFullScreen, isMaximized]);

  const isPageVisible = usePageVisibility();
  useEffect(() => {
    document.body.classList.toggle('page-is-visible', isPageVisible);
  }, [isPageVisible]);

  return (
    <div
      className={classNames({
        App: true,
        'light-theme': theme === ThemeType.light,
        'dark-theme': theme === ThemeType.dark,
      })}
    >
      {contents}
      {renderGlobalModalContainer()}
      {renderCallManager()}
      {renderLightbox()}
      {hasSelectedStoryData &&
        renderStoryViewer(() => viewStory({ closeViewer: true }))}
    </div>
  );
}

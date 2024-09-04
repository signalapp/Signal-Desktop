// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect } from 'react';
import classNames from 'classnames';

import type { ViewStoryActionCreatorType } from '../state/ducks/stories';
import type { VerificationTransport } from '../types/VerificationTransport';
import { ThemeType } from '../types/Util';
import { missingCaseError } from '../util/missingCaseError';
import { type AppStateType, AppViewType } from '../state/ducks/app';
import { SmartInstallScreen } from '../state/smart/InstallScreen';
import { StandaloneRegistration } from './StandaloneRegistration';
import { usePageVisibility } from '../hooks/usePageVisibility';

type PropsType = {
  state: AppStateType;
  openInbox: () => void;
  getCaptchaToken: () => Promise<string>;
  registerSingleDevice: (
    number: string,
    code: string,
    sessionId: string
  ) => Promise<void>;
  uploadProfile: (opts: {
    firstName: string;
    lastName: string;
  }) => Promise<void>;
  renderCallManager: () => JSX.Element;
  renderGlobalModalContainer: () => JSX.Element;
  hasSelectedStoryData: boolean;
  readyForUpdates: () => void;
  renderStoryViewer: (closeView: () => unknown) => JSX.Element;
  renderLightbox: () => JSX.Element | null;
  requestVerification: (
    number: string,
    captcha: string,
    transport: VerificationTransport
  ) => Promise<{ sessionId: string }>;
  theme: ThemeType;
  isMaximized: boolean;
  isFullScreen: boolean;
  osClassName: string;

  scrollToMessage: (conversationId: string, messageId: string) => unknown;
  viewStory: ViewStoryActionCreatorType;
  renderInbox: () => JSX.Element;
};

export function App({
  state,
  getCaptchaToken,
  hasSelectedStoryData,
  isFullScreen,
  isMaximized,
  openInbox,
  osClassName,
  readyForUpdates,
  registerSingleDevice,
  renderCallManager,
  renderGlobalModalContainer,
  renderInbox,
  renderLightbox,
  renderStoryViewer,
  requestVerification,
  theme,
  uploadProfile,
  viewStory,
}: PropsType): JSX.Element {
  let contents;

  if (state.appView === AppViewType.Installer) {
    contents = <SmartInstallScreen />;
  } else if (state.appView === AppViewType.Standalone) {
    const onComplete = () => {
      window.IPC.removeSetupMenuItems();
      openInbox();
    };
    contents = (
      <StandaloneRegistration
        onComplete={onComplete}
        getCaptchaToken={getCaptchaToken}
        readyForUpdates={readyForUpdates}
        requestVerification={requestVerification}
        registerSingleDevice={registerSingleDevice}
        uploadProfile={uploadProfile}
      />
    );
  } else if (state.appView === AppViewType.Inbox) {
    contents = renderInbox();
  } else if (state.appView === AppViewType.Blank) {
    contents = undefined;
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

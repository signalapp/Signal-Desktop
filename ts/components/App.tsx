// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect } from 'react';
import { Globals } from '@react-spring/web';
import classNames from 'classnames';

import type { ViewStoryActionCreatorType } from '../state/ducks/stories';
import type { VerificationTransport } from '../types/VerificationTransport';
import { ThemeType } from '../types/Util';
import { AppViewType } from '../state/ducks/app';
import { SmartInstallScreen } from '../state/smart/InstallScreen';
import { StandaloneRegistration } from './StandaloneRegistration';
import { usePageVisibility } from '../hooks/usePageVisibility';
import { useReducedMotion } from '../hooks/useReducedMotion';

type PropsType = {
  appView: AppViewType;
  openInbox: () => void;
  registerSingleDevice: (
    number: string,
    code: string,
    sessionId: string
  ) => Promise<void>;
  renderCallManager: () => JSX.Element;
  renderGlobalModalContainer: () => JSX.Element;
  hasSelectedStoryData: boolean;
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
  appView,
  hasSelectedStoryData,
  isFullScreen,
  isMaximized,
  openInbox,
  osClassName,
  registerSingleDevice,
  renderCallManager,
  renderGlobalModalContainer,
  renderInbox,
  renderLightbox,
  renderStoryViewer,
  requestVerification,
  theme,
  viewStory,
}: PropsType): JSX.Element {
  let contents;

  if (appView === AppViewType.Installer) {
    contents = <SmartInstallScreen />;
  } else if (appView === AppViewType.Standalone) {
    const onComplete = () => {
      window.IPC.removeSetupMenuItems();
      openInbox();
    };
    contents = (
      <StandaloneRegistration
        onComplete={onComplete}
        requestVerification={requestVerification}
        registerSingleDevice={registerSingleDevice}
      />
    );
  } else if (appView === AppViewType.Inbox) {
    contents = renderInbox();
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

  // A11y settings for react-spring
  const prefersReducedMotion = useReducedMotion();
  useEffect(() => {
    Globals.assign({
      skipAnimation: prefersReducedMotion,
    });
  }, [prefersReducedMotion]);

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

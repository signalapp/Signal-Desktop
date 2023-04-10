// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect } from 'react';
import { Globals } from '@react-spring/web';
import classNames from 'classnames';

import type { ExecuteMenuRoleType } from './TitleBarContainer';
import type { MenuOptionsType, MenuActionType } from '../types/menu';
import type { AnyToast } from '../types/Toast';
import type { ViewStoryActionCreatorType } from '../state/ducks/stories';
import type { LocalizerType } from '../types/Util';
import { ThemeType } from '../types/Util';
import { AppViewType } from '../state/ducks/app';
import { SmartInstallScreen } from '../state/smart/InstallScreen';
import { StandaloneRegistration } from './StandaloneRegistration';
import { TitleBarContainer } from './TitleBarContainer';
import { ToastManager } from './ToastManager';
import { usePageVisibility } from '../hooks/usePageVisibility';
import { useReducedMotion } from '../hooks/useReducedMotion';

type PropsType = {
  appView: AppViewType;
  openInbox: () => void;
  registerSingleDevice: (number: string, code: string) => Promise<void>;
  renderCallManager: () => JSX.Element;
  renderGlobalModalContainer: () => JSX.Element;
  isShowingStoriesView: boolean;
  i18n: LocalizerType;
  renderStories: (closeView: () => unknown) => JSX.Element;
  hasSelectedStoryData: boolean;
  renderStoryViewer: (closeView: () => unknown) => JSX.Element;
  renderLightbox: () => JSX.Element | null;
  requestVerification: (
    type: 'sms' | 'voice',
    number: string,
    token: string
  ) => Promise<void>;
  theme: ThemeType;
  isMaximized: boolean;
  isFullScreen: boolean;
  menuOptions: MenuOptionsType;
  onUndoArchive: (conversationId: string) => unknown;
  openFileInFolder: (target: string) => unknown;
  hasCustomTitleBar: boolean;
  OS: string;
  osClassName: string;
  hideMenuBar: boolean;

  executeMenuRole: ExecuteMenuRoleType;
  executeMenuAction: (action: MenuActionType) => void;
  hideToast: () => unknown;
  titleBarDoubleClick: () => void;
  toast?: AnyToast;
  scrollToMessage: (conversationId: string, messageId: string) => unknown;
  toggleStoriesView: () => unknown;
  viewStory: ViewStoryActionCreatorType;
  renderInbox: () => JSX.Element;
};

export function App({
  appView,
  executeMenuAction,
  executeMenuRole,
  hasCustomTitleBar,
  hasSelectedStoryData,
  hideMenuBar,
  hideToast,
  i18n,
  isFullScreen,
  isMaximized,
  isShowingStoriesView,
  menuOptions,
  onUndoArchive,
  openFileInFolder,
  openInbox,
  OS,
  osClassName,
  registerSingleDevice,
  renderCallManager,
  renderGlobalModalContainer,
  renderInbox,
  renderLightbox,
  renderStories,
  renderStoryViewer,
  requestVerification,
  theme,
  titleBarDoubleClick,
  toast,
  toggleStoriesView,
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
    document.body.classList.toggle('os-has-custom-titlebar', hasCustomTitleBar);
  }, [hasCustomTitleBar]);

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
    <TitleBarContainer
      theme={theme}
      isMaximized={isMaximized}
      isFullScreen={isFullScreen}
      hasCustomTitleBar={hasCustomTitleBar}
      executeMenuRole={executeMenuRole}
      titleBarDoubleClick={titleBarDoubleClick}
      hasMenu
      hideMenuBar={hideMenuBar}
      i18n={i18n}
      menuOptions={menuOptions}
      executeMenuAction={executeMenuAction}
    >
      <div
        className={classNames({
          App: true,
          'light-theme': theme === ThemeType.light,
          'dark-theme': theme === ThemeType.dark,
        })}
      >
        <ToastManager
          OS={OS}
          hideToast={hideToast}
          i18n={i18n}
          onUndoArchive={onUndoArchive}
          openFileInFolder={openFileInFolder}
          toast={toast}
        />
        {renderGlobalModalContainer()}
        {renderCallManager()}
        {renderLightbox()}
        {isShowingStoriesView && renderStories(toggleStoriesView)}
        {hasSelectedStoryData &&
          renderStoryViewer(() => viewStory({ closeViewer: true }))}
        {contents}
      </div>
    </TitleBarContainer>
  );
}

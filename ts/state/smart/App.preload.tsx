// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { App } from '../../components/App.dom.tsx';
import OS from '../../util/os/osMain.node.ts';
import { SmartCallManager } from './CallManager.preload.tsx';
import { SmartGlobalModalContainer } from './GlobalModalContainer.preload.tsx';
import { SmartLightbox } from './Lightbox.preload.tsx';
import { SmartStoryViewer } from './StoryViewer.preload.tsx';
import {
  getIsMainWindowMaximized,
  getIsMainWindowFullScreen,
  getTheme,
} from '../selectors/user.std.ts';
import { hasSelectedStoryData as getHasSelectedStoryData } from '../selectors/stories.preload.ts';
import { useConversationsActions } from '../ducks/conversations.preload.ts';
import { useStoriesActions } from '../ducks/stories.preload.ts';
import { ErrorBoundary } from '../../components/ErrorBoundary.dom.tsx';
import { ModalContainer } from '../../components/ModalContainer.dom.tsx';
import { SmartInbox } from './Inbox.preload.tsx';
import { SmartInstallScreen } from './InstallScreen.preload.tsx';
import { getApp } from '../selectors/app.std.ts';
import { SmartFunProvider } from './FunProvider.preload.tsx';
import { SmartStandaloneRegistration } from './StandaloneRegistration.preload.tsx';

function renderInbox(): React.JSX.Element {
  return <SmartInbox />;
}

function renderCallManager(): React.JSX.Element {
  return (
    <ModalContainer className="module-calling__modal-container">
      <SmartCallManager />
    </ModalContainer>
  );
}

function renderGlobalModalContainer(): React.JSX.Element {
  return <SmartGlobalModalContainer />;
}

function renderInstallScreen(): React.JSX.Element {
  return <SmartInstallScreen />;
}

function renderLightbox(): React.JSX.Element {
  return <SmartLightbox />;
}

function renderStandaloneRegistration(): React.JSX.Element {
  return (
    <ErrorBoundary name="App/renderStandaloneRegistration">
      <SmartStandaloneRegistration />
    </ErrorBoundary>
  );
}

function renderStoryViewer(closeView: () => unknown): React.JSX.Element {
  return (
    <ErrorBoundary name="App/renderStoryViewer" closeView={closeView}>
      <SmartStoryViewer />
    </ErrorBoundary>
  );
}

export const SmartApp = memo(function SmartApp() {
  const state = useSelector(getApp);
  const isMaximized = useSelector(getIsMainWindowMaximized);
  const isFullScreen = useSelector(getIsMainWindowFullScreen);
  const hasSelectedStoryData = useSelector(getHasSelectedStoryData);
  const theme = useSelector(getTheme);

  const { scrollToMessage } = useConversationsActions();
  const { viewStory } = useStoriesActions();

  const osClassName = OS.getClassName();

  return (
    <SmartFunProvider>
      <App
        state={state}
        isMaximized={isMaximized}
        isFullScreen={isFullScreen}
        osClassName={osClassName}
        renderCallManager={renderCallManager}
        renderGlobalModalContainer={renderGlobalModalContainer}
        renderInstallScreen={renderInstallScreen}
        renderLightbox={renderLightbox}
        renderStandaloneRegistration={renderStandaloneRegistration}
        hasSelectedStoryData={hasSelectedStoryData}
        renderStoryViewer={renderStoryViewer}
        renderInbox={renderInbox}
        theme={theme}
        scrollToMessage={scrollToMessage}
        viewStory={viewStory}
      />
    </SmartFunProvider>
  );
});

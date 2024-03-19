// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import type { VerificationTransport } from '../../types/VerificationTransport';
import { App } from '../../components/App';
import OS from '../../util/os/osMain';
import { strictAssert } from '../../util/assert';
import { SmartCallManager } from './CallManager';
import { SmartGlobalModalContainer } from './GlobalModalContainer';
import { SmartLightbox } from './Lightbox';
import { SmartStoryViewer } from './StoryViewer';
import {
  getIsMainWindowMaximized,
  getIsMainWindowFullScreen,
  getTheme,
} from '../selectors/user';
import { hasSelectedStoryData as getHasSelectedStoryData } from '../selectors/stories';
import { useAppActions } from '../ducks/app';
import { useConversationsActions } from '../ducks/conversations';
import { useStoriesActions } from '../ducks/stories';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { ModalContainer } from '../../components/ModalContainer';
import { SmartInbox } from './Inbox';
import { getAppView } from '../selectors/app';

function renderInbox(): JSX.Element {
  return <SmartInbox />;
}

function renderCallManager(): JSX.Element {
  return (
    <ModalContainer className="module-calling__modal-container">
      <SmartCallManager />
    </ModalContainer>
  );
}

function renderGlobalModalContainer(): JSX.Element {
  return <SmartGlobalModalContainer />;
}

function renderLightbox(): JSX.Element {
  return <SmartLightbox />;
}

function renderStoryViewer(closeView: () => unknown): JSX.Element {
  return (
    <ErrorBoundary name="App/renderStoryViewer" closeView={closeView}>
      <SmartStoryViewer />
    </ErrorBoundary>
  );
}

function requestVerification(
  number: string,
  captcha: string,
  transport: VerificationTransport
): Promise<{ sessionId: string }> {
  const { server } = window.textsecure;
  strictAssert(server !== undefined, 'WebAPI not available');
  return server.requestVerification(number, captcha, transport);
}

function registerSingleDevice(
  number: string,
  code: string,
  sessionId: string
): Promise<void> {
  return window
    .getAccountManager()
    .registerSingleDevice(number, code, sessionId);
}

export const SmartApp = memo(function SmartApp() {
  const appView = useSelector(getAppView);
  const isMaximized = useSelector(getIsMainWindowMaximized);
  const isFullScreen = useSelector(getIsMainWindowFullScreen);
  const hasSelectedStoryData = useSelector(getHasSelectedStoryData);
  const theme = useSelector(getTheme);

  const { openInbox } = useAppActions();
  const { scrollToMessage } = useConversationsActions();
  const { viewStory } = useStoriesActions();

  const osClassName = OS.getClassName();

  return (
    <App
      appView={appView}
      isMaximized={isMaximized}
      isFullScreen={isFullScreen}
      osClassName={osClassName}
      renderCallManager={renderCallManager}
      renderGlobalModalContainer={renderGlobalModalContainer}
      renderLightbox={renderLightbox}
      hasSelectedStoryData={hasSelectedStoryData}
      renderStoryViewer={renderStoryViewer}
      renderInbox={renderInbox}
      requestVerification={requestVerification}
      registerSingleDevice={registerSingleDevice}
      theme={theme}
      openInbox={openInbox}
      scrollToMessage={scrollToMessage}
      viewStory={viewStory}
    />
  );
});

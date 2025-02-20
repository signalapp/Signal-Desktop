// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import type { VerificationTransport } from '../../types/VerificationTransport';
import { DataWriter } from '../../sql/Client';
import { App } from '../../components/App';
import OS from '../../util/os/osMain';
import { getConversation } from '../../util/getConversation';
import { getChallengeURL } from '../../challenge';
import { writeProfile } from '../../services/writeProfile';
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
import { getApp } from '../selectors/app';
import { SmartFunProvider } from './FunProvider';

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

async function getCaptchaToken(): Promise<string> {
  const url = getChallengeURL('registration');
  document.location.href = url;
  if (!window.Signal.challengeHandler) {
    throw new Error('Captcha handler is not ready!');
  }
  return window.Signal.challengeHandler.requestCaptcha({
    reason: 'standalone registration',
  });
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

function readyForUpdates(): void {
  window.IPC.readyForUpdates();
}

async function uploadProfile({
  firstName,
  lastName,
}: {
  firstName: string;
  lastName: string;
}): Promise<void> {
  const us = window.ConversationController.getOurConversationOrThrow();
  us.set('profileName', firstName);
  us.set('profileFamilyName', lastName);
  us.captureChange('standaloneProfile');
  await DataWriter.updateConversation(us.attributes);

  await writeProfile(getConversation(us), {
    keepAvatar: true,
  });
}

export const SmartApp = memo(function SmartApp() {
  const state = useSelector(getApp);
  const isMaximized = useSelector(getIsMainWindowMaximized);
  const isFullScreen = useSelector(getIsMainWindowFullScreen);
  const hasSelectedStoryData = useSelector(getHasSelectedStoryData);
  const theme = useSelector(getTheme);

  const { openInbox } = useAppActions();
  const { scrollToMessage } = useConversationsActions();
  const { viewStory } = useStoriesActions();

  const osClassName = OS.getClassName();

  return (
    <SmartFunProvider>
      <App
        state={state}
        isMaximized={isMaximized}
        isFullScreen={isFullScreen}
        getCaptchaToken={getCaptchaToken}
        osClassName={osClassName}
        renderCallManager={renderCallManager}
        renderGlobalModalContainer={renderGlobalModalContainer}
        renderLightbox={renderLightbox}
        hasSelectedStoryData={hasSelectedStoryData}
        readyForUpdates={readyForUpdates}
        renderStoryViewer={renderStoryViewer}
        renderInbox={renderInbox}
        requestVerification={requestVerification}
        registerSingleDevice={registerSingleDevice}
        uploadProfile={uploadProfile}
        theme={theme}
        openInbox={openInbox}
        scrollToMessage={scrollToMessage}
        viewStory={viewStory}
      />
    </SmartFunProvider>
  );
});

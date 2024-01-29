// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
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
  getTheme,
  getIsMainWindowMaximized,
  getIsMainWindowFullScreen,
} from '../selectors/user';
import { hasSelectedStoryData } from '../selectors/stories';
import type { StateType } from '../reducer';
import { useAppActions } from '../ducks/app';
import { useConversationsActions } from '../ducks/conversations';
import { useStoriesActions } from '../ducks/stories';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { ModalContainer } from '../../components/ModalContainer';
import { SmartInbox } from './Inbox';

function renderInbox(): JSX.Element {
  return <SmartInbox />;
}

export function SmartApp(): JSX.Element {
  const app = useSelector((state: StateType) => state.app);

  const { openInbox } = useAppActions();

  const { scrollToMessage } = useConversationsActions();

  const { viewStory } = useStoriesActions();

  return (
    <App
      {...app}
      isMaximized={useSelector(getIsMainWindowMaximized)}
      isFullScreen={useSelector(getIsMainWindowFullScreen)}
      osClassName={OS.getClassName()}
      renderCallManager={() => (
        <ModalContainer className="module-calling__modal-container">
          <SmartCallManager />
        </ModalContainer>
      )}
      renderGlobalModalContainer={() => <SmartGlobalModalContainer />}
      renderLightbox={() => <SmartLightbox />}
      hasSelectedStoryData={useSelector(hasSelectedStoryData)}
      renderStoryViewer={(closeView: () => unknown) => (
        <ErrorBoundary name="App/renderStoryViewer" closeView={closeView}>
          <SmartStoryViewer />
        </ErrorBoundary>
      )}
      renderInbox={renderInbox}
      requestVerification={(
        number: string,
        captcha: string,
        transport: VerificationTransport
      ): Promise<{ sessionId: string }> => {
        const { server } = window.textsecure;
        strictAssert(server !== undefined, 'WebAPI not available');

        return server.requestVerification(number, captcha, transport);
      }}
      registerSingleDevice={(
        number: string,
        code: string,
        sessionId: string
      ): Promise<void> => {
        return window
          .getAccountManager()
          .registerSingleDevice(number, code, sessionId);
      }}
      theme={useSelector(getTheme)}
      openInbox={openInbox}
      scrollToMessage={scrollToMessage}
      viewStory={viewStory}
    />
  );
}

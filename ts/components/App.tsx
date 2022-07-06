// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ComponentProps } from 'react';
import React, { useEffect } from 'react';
import { Globals } from '@react-spring/web';
import classNames from 'classnames';

import { AppViewType } from '../state/ducks/app';
import { Inbox } from './Inbox';
import { SmartInstallScreen } from '../state/smart/InstallScreen';
import { StandaloneRegistration } from './StandaloneRegistration';
import { ThemeType } from '../types/Util';
import type { LocaleMessagesType } from '../types/I18N';
import { usePageVisibility } from '../hooks/usePageVisibility';
import { useReducedMotion } from '../hooks/useReducedMotion';
import type { MenuOptionsType, MenuActionType } from '../types/menu';
import { TitleBarContainer } from './TitleBarContainer';
import type { ExecuteMenuRoleType } from './TitleBarContainer';
import type { SelectedStoryDataType } from '../state/ducks/stories';

type PropsType = {
  appView: AppViewType;
  localeMessages: LocaleMessagesType;
  openInbox: () => void;
  registerSingleDevice: (number: string, code: string) => Promise<void>;
  renderCallManager: () => JSX.Element;
  renderGlobalModalContainer: () => JSX.Element;
  isShowingStoriesView: boolean;
  renderStories: () => JSX.Element;
  selectedStoryData?: SelectedStoryDataType;
  renderStoryViewer: () => JSX.Element;
  requestVerification: (
    type: 'sms' | 'voice',
    number: string,
    token: string
  ) => Promise<void>;
  theme: ThemeType;
  isMaximized: boolean;
  isFullScreen: boolean;
  menuOptions: MenuOptionsType;
  hasCustomTitleBar: boolean;
  hideMenuBar: boolean;

  executeMenuRole: ExecuteMenuRoleType;
  executeMenuAction: (action: MenuActionType) => void;
  titleBarDoubleClick: () => void;
} & ComponentProps<typeof Inbox>;

export const App = ({
  appView,
  cancelConversationVerification,
  conversationsStoppingSend,
  executeMenuAction,
  executeMenuRole,
  getPreferredBadge,
  hasInitialLoadCompleted,
  hideMenuBar,
  i18n,
  isCustomizingPreferredReactions,
  isFullScreen,
  isMaximized,
  isShowingStoriesView,
  hasCustomTitleBar,
  localeMessages,
  menuOptions,
  openInbox,
  registerSingleDevice,
  renderCallManager,
  renderCustomizingPreferredReactionsModal,
  renderGlobalModalContainer,
  renderLeftPane,
  renderSafetyNumber,
  renderStories,
  renderStoryViewer,
  requestVerification,
  selectedConversationId,
  selectedMessage,
  selectedStoryData,
  showConversation,
  showWhatsNewModal,
  theme,
  titleBarDoubleClick,
  verifyConversationsStoppingSend,
}: PropsType): JSX.Element => {
  let contents;

  if (appView === AppViewType.Installer) {
    contents = <SmartInstallScreen />;
  } else if (appView === AppViewType.Standalone) {
    const onComplete = () => {
      window.removeSetupMenuItems();
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
    contents = (
      <Inbox
        cancelConversationVerification={cancelConversationVerification}
        conversationsStoppingSend={conversationsStoppingSend}
        hasInitialLoadCompleted={hasInitialLoadCompleted}
        getPreferredBadge={getPreferredBadge}
        i18n={i18n}
        isCustomizingPreferredReactions={isCustomizingPreferredReactions}
        renderCustomizingPreferredReactionsModal={
          renderCustomizingPreferredReactionsModal
        }
        renderLeftPane={renderLeftPane}
        renderSafetyNumber={renderSafetyNumber}
        selectedConversationId={selectedConversationId}
        selectedMessage={selectedMessage}
        showConversation={showConversation}
        showWhatsNewModal={showWhatsNewModal}
        theme={theme}
        verifyConversationsStoppingSend={verifyConversationsStoppingSend}
      />
    );
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
      localeMessages={localeMessages}
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
        {renderGlobalModalContainer()}
        {renderCallManager()}
        {isShowingStoriesView && renderStories()}
        {selectedStoryData && renderStoryViewer()}
        {contents}
      </div>
    </TitleBarContainer>
  );
};

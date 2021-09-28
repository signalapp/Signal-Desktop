// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { ComponentProps, useEffect } from 'react';
import classNames from 'classnames';

import { AppViewType } from '../state/ducks/app';
import { Inbox } from './Inbox';
import { Install } from './Install';
import { StandaloneRegistration } from './StandaloneRegistration';
import { ThemeType } from '../types/Util';
import { usePageVisibility } from '../hooks/usePageVisibility';

type PropsType = {
  appView: AppViewType;
  renderCallManager: () => JSX.Element;
  renderGlobalModalContainer: () => JSX.Element;
  theme: ThemeType;
} & ComponentProps<typeof Inbox>;

export const App = ({
  appView,
  cancelMessagesPendingConversationVerification,
  conversationsStoppingMessageSendBecauseOfVerification,
  hasInitialLoadCompleted,
  i18n,
  isCustomizingPreferredReactions,
  numberOfMessagesPendingBecauseOfVerification,
  renderCallManager,
  renderCustomizingPreferredReactionsModal,
  renderGlobalModalContainer,
  renderSafetyNumber,
  theme,
  verifyConversationsStoppingMessageSend,
}: PropsType): JSX.Element => {
  let contents;

  if (appView === AppViewType.Installer) {
    contents = <Install />;
  } else if (appView === AppViewType.Standalone) {
    contents = <StandaloneRegistration />;
  } else if (appView === AppViewType.Inbox) {
    contents = (
      <Inbox
        cancelMessagesPendingConversationVerification={
          cancelMessagesPendingConversationVerification
        }
        conversationsStoppingMessageSendBecauseOfVerification={
          conversationsStoppingMessageSendBecauseOfVerification
        }
        hasInitialLoadCompleted={hasInitialLoadCompleted}
        i18n={i18n}
        isCustomizingPreferredReactions={isCustomizingPreferredReactions}
        numberOfMessagesPendingBecauseOfVerification={
          numberOfMessagesPendingBecauseOfVerification
        }
        renderCustomizingPreferredReactionsModal={
          renderCustomizingPreferredReactionsModal
        }
        renderSafetyNumber={renderSafetyNumber}
        verifyConversationsStoppingMessageSend={
          verifyConversationsStoppingMessageSend
        }
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

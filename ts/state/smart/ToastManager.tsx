// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import type { AnyActionableMegaphone } from '../../types/Megaphone.js';
import { MegaphoneType } from '../../types/Megaphone.js';
import { UsernameOnboardingState } from '../../types/globalModals.js';
import OS from '../../util/os/osMain.js';
import { drop } from '../../util/drop.js';
import { getIntl } from '../selectors/user.js';
import {
  getGlobalModalsState,
  isShowingAnyModal as getIsShowingAnyModal,
} from '../selectors/globalModals.js';
import { hasSelectedStoryData } from '../selectors/stories.js';
import { shouldShowLightbox } from '../selectors/lightbox.js';
import { isInFullScreenCall as getIsInFullScreenCall } from '../selectors/calling.js';
import { getSelectedNavTab } from '../selectors/nav.js';
import {
  getMe,
  getSelectedConversationId,
} from '../selectors/conversations.js';
import { useConversationsActions } from '../ducks/conversations.js';
import { useToastActions } from '../ducks/toast.js';
import { useGlobalModalActions } from '../ducks/globalModals.js';
import { useNavActions } from '../ducks/nav.js';
import { NavTab } from '../../types/Nav.js';
import { getHasCompletedUsernameOnboarding } from '../selectors/items.js';
import { ToastManager } from '../../components/ToastManager.js';
import type { WidthBreakpoint } from '../../components/_util.js';
import { getToast } from '../selectors/toast.js';
import { useDonationsActions } from '../ducks/donations.js';

export type SmartPropsType = Readonly<{
  disableMegaphone?: boolean;
  containerWidthBreakpoint: WidthBreakpoint;
}>;

function handleShowDebugLog() {
  window.IPC.showDebugLog();
}

export const SmartToastManager = memo(function SmartToastManager({
  disableMegaphone = false,
  containerWidthBreakpoint,
}: SmartPropsType) {
  const i18n = useSelector(getIntl);
  const hasCompletedUsernameOnboarding = useSelector(
    getHasCompletedUsernameOnboarding
  );
  const toast = useSelector(getToast);
  const globalModals = useSelector(getGlobalModalsState);
  const isShowingAnyModal = useSelector(getIsShowingAnyModal);
  const isShowingStory = useSelector(hasSelectedStoryData);
  const isShowingLightbox = useSelector(shouldShowLightbox);
  const isInFullScreenCall = useSelector(getIsInFullScreenCall);
  const { username } = useSelector(getMe);
  const selectedNavTab = useSelector(getSelectedNavTab);
  const selectedConversationId = useSelector(getSelectedConversationId);
  const { changeLocation } = useNavActions();
  const { setDidResume } = useDonationsActions();

  const { onUndoArchive } = useConversationsActions();
  const { openFileInFolder, hideToast } = useToastActions();
  const { toggleUsernameOnboarding } = useGlobalModalActions();

  let megaphone: AnyActionableMegaphone | undefined;

  if (
    !hasCompletedUsernameOnboarding &&
    !username &&
    globalModals.usernameOnboardingState === UsernameOnboardingState.NeverShown
  ) {
    megaphone = {
      type: MegaphoneType.UsernameOnboarding,
      onLearnMore: toggleUsernameOnboarding,
      onDismiss: () => {
        drop(window.storage.put('hasCompletedUsernameOnboarding', true));
      },
    };
  }

  const centerToast =
    isShowingAnyModal ||
    isShowingStory ||
    isShowingLightbox ||
    isInFullScreenCall;

  const isCompositionAreaVisible =
    selectedNavTab === NavTab.Chats && Boolean(selectedConversationId);

  return (
    <ToastManager
      changeLocation={changeLocation}
      i18n={i18n}
      OS={OS.getName()}
      toast={toast}
      megaphone={disableMegaphone ? undefined : megaphone}
      onShowDebugLog={handleShowDebugLog}
      onUndoArchive={onUndoArchive}
      openFileInFolder={openFileInFolder}
      hideToast={hideToast}
      setDidResumeDonation={setDidResume}
      centerToast={centerToast}
      containerWidthBreakpoint={containerWidthBreakpoint}
      isCompositionAreaVisible={isCompositionAreaVisible}
      isInFullScreenCall={isInFullScreenCall}
    />
  );
});

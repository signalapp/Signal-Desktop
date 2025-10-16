// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import type { AnyActionableMegaphone } from '../../types/Megaphone.std.js';
import { MegaphoneType } from '../../types/Megaphone.std.js';
import { UsernameOnboardingState } from '../../types/globalModals.std.js';
import OS from '../../util/os/osMain.node.js';
import { drop } from '../../util/drop.std.js';
import { getIntl } from '../selectors/user.std.js';
import {
  getGlobalModalsState,
  isShowingAnyModal as getIsShowingAnyModal,
} from '../selectors/globalModals.std.js';
import { hasSelectedStoryData } from '../selectors/stories.preload.js';
import { shouldShowLightbox } from '../selectors/lightbox.std.js';
import { isInFullScreenCall as getIsInFullScreenCall } from '../selectors/calling.std.js';
import { getSelectedNavTab } from '../selectors/nav.preload.js';
import {
  getMe,
  getSelectedConversationId,
} from '../selectors/conversations.dom.js';
import { useConversationsActions } from '../ducks/conversations.preload.js';
import { useToastActions } from '../ducks/toast.preload.js';
import { useGlobalModalActions } from '../ducks/globalModals.preload.js';
import { useNavActions } from '../ducks/nav.std.js';
import { NavTab } from '../../types/Nav.std.js';
import { getHasCompletedUsernameOnboarding } from '../selectors/items.dom.js';
import { ToastManager } from '../../components/ToastManager.dom.js';
import type { WidthBreakpoint } from '../../components/_util.std.js';
import { getToast } from '../selectors/toast.std.js';
import { useDonationsActions } from '../ducks/donations.preload.js';
import { itemStorage } from '../../textsecure/Storage.preload.js';

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
        drop(itemStorage.put('hasCompletedUsernameOnboarding', true));
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

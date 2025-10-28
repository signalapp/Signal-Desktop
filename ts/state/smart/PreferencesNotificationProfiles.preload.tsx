// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo } from 'react';
import type { MutableRefObject } from 'react';
import { useSelector } from 'react-redux';

import { getIntl, getTheme } from '../selectors/user.std.js';
import {
  NotificationProfilesCreateFlow,
  NotificationProfilesHome,
} from '../../components/PreferencesNotificationProfiles.dom.js';
import {
  getAllComposableConversations,
  getConversationSelector,
} from '../selectors/conversations.dom.js';
import { getPreferredBadgeSelector } from '../selectors/badges.preload.js';
import { useNotificationProfilesActions } from '../ducks/notificationProfiles.preload.js';
import {
  getActiveProfile,
  getLoading,
  getProfiles,
} from '../selectors/notificationProfiles.dom.js';
import type { SettingsLocation } from '../../types/Nav.std.js';
import { getItems } from '../selectors/items.dom.js';
import { useItemsActions } from '../ducks/items.preload.js';

export type ExternalProps = {
  contentsRef: MutableRefObject<HTMLDivElement | null>;
  setSettingsLocation: (location: SettingsLocation) => void;
};

export const SmartNotificationProfilesHome = memo(
  function SmartNotificationProfilesHome({
    contentsRef,
    setSettingsLocation,
  }: ExternalProps) {
    const i18n = useSelector(getIntl);
    const theme = useSelector(getTheme);
    const items = useSelector(getItems);

    const allProfiles = useSelector(getProfiles);
    const activeProfile = useSelector(getActiveProfile);
    const loading = useSelector(getLoading);

    const conversations = useSelector(getAllComposableConversations);
    const conversationSelector = useSelector(getConversationSelector);
    const preferredBadgeSelector = useSelector(getPreferredBadgeSelector);

    const isSyncEnabled = !items.notificationProfileSyncDisabled;
    const hasOnboardingBeenSeen = Boolean(
      items.hasSeenNotificationProfileOnboarding
    );

    const {
      markProfileDeleted,
      setIsSyncEnabled: originalSetIsSyncEnabled,
      setProfileOverride,
      updateProfile,
    } = useNotificationProfilesActions();
    const { putItem } = useItemsActions();

    const setIsSyncEnabled = React.useCallback(
      (value: boolean) => {
        originalSetIsSyncEnabled(value, { fromStorageService: false });
      },
      [originalSetIsSyncEnabled]
    );
    const setHasOnboardingBeenSeen = React.useCallback(
      (value: boolean) => {
        putItem('hasSeenNotificationProfileOnboarding', value);
      },
      [putItem]
    );

    return (
      <NotificationProfilesHome
        activeProfileId={activeProfile?.id}
        allProfiles={allProfiles}
        contentsRef={contentsRef}
        conversations={conversations}
        conversationSelector={conversationSelector}
        i18n={i18n}
        isSyncEnabled={isSyncEnabled}
        hasOnboardingBeenSeen={hasOnboardingBeenSeen}
        loading={loading}
        markProfileDeleted={markProfileDeleted}
        preferredBadgeSelector={preferredBadgeSelector}
        setHasOnboardingBeenSeen={setHasOnboardingBeenSeen}
        setIsSyncEnabled={setIsSyncEnabled}
        setSettingsLocation={setSettingsLocation}
        setProfileOverride={setProfileOverride}
        theme={theme}
        updateProfile={updateProfile}
      />
    );
  }
);

export const SmartNotificationProfilesCreateFlow = memo(
  function SmartNotificationProfilesCreateFlow({
    contentsRef,
    setSettingsLocation,
  }: ExternalProps) {
    const i18n = useSelector(getIntl);
    const theme = useSelector(getTheme);

    const conversations = useSelector(getAllComposableConversations);
    const conversationSelector = useSelector(getConversationSelector);
    const preferredBadgeSelector = useSelector(getPreferredBadgeSelector);

    const { createProfile } = useNotificationProfilesActions();

    return (
      <NotificationProfilesCreateFlow
        contentsRef={contentsRef}
        conversations={conversations}
        conversationSelector={conversationSelector}
        createProfile={createProfile}
        i18n={i18n}
        preferredBadgeSelector={preferredBadgeSelector}
        setSettingsLocation={setSettingsLocation}
        theme={theme}
      />
    );
  }
);

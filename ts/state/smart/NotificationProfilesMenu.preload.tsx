// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useSelector } from 'react-redux';

import { getIntl } from '../selectors/user.std.ts';
import { NotificationProfilesMenu } from '../../components/NotificationProfilesMenu.dom.tsx';
import { useNotificationProfilesActions } from '../ducks/notificationProfiles.preload.ts';
import {
  getActiveProfile,
  getLoading,
  getOverride,
  getProfiles,
} from '../selectors/notificationProfiles.dom.ts';
import { useNavActions } from '../ducks/nav.std.ts';
import { NavTab, SettingsPage } from '../../types/Nav.std.ts';

export function SmartNotificationProfilesMenu(): React.JSX.Element {
  const i18n = useSelector(getIntl);

  const allProfiles = useSelector(getProfiles);
  const activeProfile = useSelector(getActiveProfile);
  const currentOverride = useSelector(getOverride);
  const loading = useSelector(getLoading);

  const { changeLocation } = useNavActions();
  const { setProfileOverride } = useNotificationProfilesActions();

  const goToSettings = () => {
    changeLocation({
      tab: NavTab.Settings,
      details: {
        page: SettingsPage.NotificationProfilesHome,
      },
    });
  };

  return (
    <NotificationProfilesMenu
      activeProfileId={activeProfile?.id}
      allProfiles={allProfiles}
      currentOverride={currentOverride}
      i18n={i18n}
      loading={loading}
      onGoToSettings={goToSettings}
      setProfileOverride={setProfileOverride}
    />
  );
}

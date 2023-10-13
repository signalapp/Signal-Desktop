import React from 'react';

import useUpdate from 'react-use/lib/useUpdate';
import { SettingsKey } from '../../../data/settings-key';
import { isHideMenuBarSupported } from '../../../types/Settings';
import { useHasFollowSystemThemeEnabled } from '../../../state/selectors/settings';
import { checkThemeCongruency } from '../../../themes/SessionTheme';
import { SessionToggleWithDescription } from '../SessionSettingListItem';
import { SettingsThemeSwitcher } from '../SettingsThemeSwitcher';
import { ZoomingSessionSlider } from '../ZoomingSessionSlider';

export const SettingsCategoryAppearance = (props: { hasPassword: boolean | null }) => {
  const forceUpdate = useUpdate();
  const isFollowSystemThemeEnabled = useHasFollowSystemThemeEnabled();

  if (props.hasPassword !== null) {
    const isHideMenuBarActive =
      window.getSettingValue(SettingsKey.settingsMenuBar) === undefined
        ? true
        : window.getSettingValue(SettingsKey.settingsMenuBar);

    return (
      <>
        <SettingsThemeSwitcher />
        <ZoomingSessionSlider />
        {isHideMenuBarSupported() && (
          <SessionToggleWithDescription
            onClickToggle={() => {
              window.toggleMenuBar();
              forceUpdate();
            }}
            title={window.i18n('hideMenuBarTitle')}
            description={window.i18n('hideMenuBarDescription')}
            active={isHideMenuBarActive}
          />
        )}
        <SessionToggleWithDescription
          onClickToggle={() => {
            const toggledValue = !isFollowSystemThemeEnabled;
            void window.setSettingValue(SettingsKey.hasFollowSystemThemeEnabled, toggledValue);
            if (!isFollowSystemThemeEnabled) {
              void checkThemeCongruency();
            }
          }}
          title={window.i18n('matchThemeSystemSettingTitle')}
          description={window.i18n('matchThemeSystemSettingDescription')}
          active={isFollowSystemThemeEnabled}
        />
      </>
    );
  }
  return null;
};

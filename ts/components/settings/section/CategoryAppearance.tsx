import useUpdate from 'react-use/lib/useUpdate';
import { SettingsKey } from '../../../data/settings-key';
import { useHasFollowSystemThemeEnabled } from '../../../state/selectors/settings';
import { ensureThemeConsistency } from '../../../themes/SessionTheme';
import { isHideMenuBarSupported } from '../../../types/Settings';
import { SessionToggleWithDescription } from '../SessionSettingListItem';
import { SettingsThemeSwitcher } from '../SettingsThemeSwitcher';
import { ZoomingSessionSlider } from '../ZoomingSessionSlider';

export const SettingsCategoryAppearance = () => {
  const forceUpdate = useUpdate();
  const isFollowSystemThemeEnabled = useHasFollowSystemThemeEnabled();

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
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onClickToggle={async () => {
          const toggledValue = !isFollowSystemThemeEnabled;
          await window.setSettingValue(SettingsKey.hasFollowSystemThemeEnabled, toggledValue);
          if (!isFollowSystemThemeEnabled) {
            await ensureThemeConsistency();
          }
        }}
        title={window.i18n('matchThemeSystemSettingTitle')}
        description={window.i18n('matchThemeSystemSettingDescription')}
        active={isFollowSystemThemeEnabled}
        dataTestId="enable-follow-system-theme"
      />
    </>
  );
};

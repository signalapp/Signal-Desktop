import { useSelector } from 'react-redux';
import { SettingsKey } from '../../data/settings-key';
import { StateType } from '../reducer';

const getLinkPreviewEnabled = (state: StateType) =>
  state.settings.settingsBools[SettingsKey.settingsLinkPreview];

const getHasDeviceOutdatedSyncing = (state: StateType) =>
  state.settings.settingsBools[SettingsKey.someDeviceOutdatedSyncing];

export const useHasLinkPreviewEnabled = () => {
  const value = useSelector(getLinkPreviewEnabled);
  return Boolean(value);
};

export const useHasDeviceOutdatedSyncing = () => {
  const value = useSelector(getHasDeviceOutdatedSyncing);
  return Boolean(value);
};

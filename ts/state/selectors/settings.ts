import { useSelector } from 'react-redux';
import { SettingsKey } from '../../data/settings-key';
import { StateType } from '../reducer';

const getLinkPreviewEnabled = (state: StateType) =>
  state.settings.settingsBools[SettingsKey.settingsLinkPreview];

const getHasDeviceOutdatedSyncing = (state: StateType) =>
  state.settings.settingsBools[SettingsKey.someDeviceOutdatedSyncing];

const getHasBlindedMsgRequestsEnabled = (state: StateType) =>
  state.settings.settingsBools[SettingsKey.hasBlindedMsgRequestsEnabled];

const getHasFollowSystemThemeEnabled = (state: StateType) =>
  state.settings.settingsBools[SettingsKey.hasFollowSystemThemeEnabled];

const getHasShiftSendEnabled = (state: StateType) =>
  state.settings.settingsBools[SettingsKey.hasShiftSendEnabled];

export const useHasLinkPreviewEnabled = () => {
  const value = useSelector(getLinkPreviewEnabled);
  return Boolean(value);
};

export const useHasDeviceOutdatedSyncing = () => {
  const value = useSelector(getHasDeviceOutdatedSyncing);
  return Boolean(value);
};

export const useHasBlindedMsgRequestsEnabled = () => {
  const value = useSelector(getHasBlindedMsgRequestsEnabled);
  return Boolean(value);
};

export const useHasFollowSystemThemeEnabled = () => {
  const value = useSelector(getHasFollowSystemThemeEnabled);
  return Boolean(value);
};

export const useHasEnterSendEnabled = () => {
  const value = useSelector(getHasShiftSendEnabled);

  return Boolean(value);
};

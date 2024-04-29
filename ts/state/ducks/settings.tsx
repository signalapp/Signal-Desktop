import { isBoolean } from 'lodash';

import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { SettingsKey } from '../../data/settings-key';

const SettingsBoolsKeyTrackedInRedux = [
  SettingsKey.someDeviceOutdatedSyncing,
  SettingsKey.settingsLinkPreview,
  SettingsKey.hasBlindedMsgRequestsEnabled,
  SettingsKey.hasFollowSystemThemeEnabled,
  SettingsKey.hasShiftSendEnabled,
] as const;

export type SettingsState = {
  settingsBools: Record<(typeof SettingsBoolsKeyTrackedInRedux)[number], boolean>;
};

export function getSettingsInitialState() {
  return {
    settingsBools: {
      someDeviceOutdatedSyncing: false,
      'link-preview-setting': false, // this is the value of SettingsKey.settingsLinkPreview
      hasBlindedMsgRequestsEnabled: false,
      hasFollowSystemThemeEnabled: false,
      hasShiftSendEnabled: false,
    },
  };
}

function isTrackedBoolean(key: string): key is (typeof SettingsBoolsKeyTrackedInRedux)[number] {
  return SettingsBoolsKeyTrackedInRedux.indexOf(key as any) !== -1;
}

/**
 * This slice is the one holding the settings of the currently logged in user in redux.
 * This is in addition to the settings stored in the Storage class but is a memory only representation of them.
 * You should not try to make changes here, but instead through the Storage class.
 * What you can do with this slice, is to create selectors and hooks to keep your UI in sync with the state in whatever is Storage.
 */
const settingsSlice = createSlice({
  name: 'settings',
  // when this createSlice gets invoke, the storage is not ready, but redux still wants a state so we just avoid hitting the storage.
  // Once the storage is ready,
  initialState: getSettingsInitialState(),
  reducers: {
    updateAllOnStorageReady(
      state,
      {
        payload,
      }: PayloadAction<{
        settingsLinkPreview: boolean;
        someDeviceOutdatedSyncing: boolean;
        hasBlindedMsgRequestsEnabled: boolean;
        hasFollowSystemThemeEnabled: boolean;
        hasShiftSendEnabled: boolean;
      }>
    ) {
      const {
        hasBlindedMsgRequestsEnabled,
        hasFollowSystemThemeEnabled,
        settingsLinkPreview,
        someDeviceOutdatedSyncing,
        hasShiftSendEnabled,
      } = payload;

      state.settingsBools.someDeviceOutdatedSyncing = someDeviceOutdatedSyncing;
      state.settingsBools['link-preview-setting'] = settingsLinkPreview;
      state.settingsBools.hasBlindedMsgRequestsEnabled = hasBlindedMsgRequestsEnabled;
      state.settingsBools.hasFollowSystemThemeEnabled = hasFollowSystemThemeEnabled;
      state.settingsBools.hasShiftSendEnabled = hasShiftSendEnabled;

      return state;
    },
    updateSettingsBoolValue(state, action: PayloadAction<{ id: string; value: boolean }>) {
      const { id, value } = action.payload;

      if (!isTrackedBoolean(id) || !isBoolean(value)) {
        return state;
      }

      state.settingsBools[id] = value;

      return state;
    },
    deleteSettingsBoolValue(state, action: PayloadAction<string>) {
      if (!isTrackedBoolean(action.payload)) {
        return state;
      }

      delete state.settingsBools[action.payload];
      return state;
    },
  },
});

const { actions, reducer } = settingsSlice;
export const { updateSettingsBoolValue, deleteSettingsBoolValue, updateAllOnStorageReady } =
  actions;
export const settingsReducer = reducer;

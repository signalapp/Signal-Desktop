import { createSelector } from '@reduxjs/toolkit';

import { SessionSettingCategory } from '../../components/settings/SessionSettings';
import { LeftOverlayMode, RightOverlayMode, SectionStateType, SectionType } from '../ducks/section';
import { StateType } from '../reducer';

export const getSection = (state: StateType): SectionStateType => state.section;

export const getFocusedSection = createSelector(
  getSection,
  (state: SectionStateType): SectionType => state.focusedSection
);

export const getIsMessageSection = (state: StateType) => {
  return state.section.focusedSection === SectionType.Message;
};

export const getFocusedSettingsSection = createSelector(
  getSection,
  (state: SectionStateType): SessionSettingCategory | undefined => state.focusedSettingsSection
);

export const getIsAppFocused = createSelector(
  getSection,
  (state: SectionStateType): boolean => state.isAppFocused
);

// TODO This should probably be renamed to getLeftOverlayMode and the props should be updated.
export const getLeftOverlayMode = createSelector(
  getSection,
  (state: SectionStateType): LeftOverlayMode | undefined => state.leftOverlayMode
);

export const getRightOverlayMode = (state: StateType): RightOverlayMode | undefined => {
  return state.section.rightOverlayMode;
};

export const getIsMessageRequestOverlayShown = (state: StateType) => {
  const focusedSection = getFocusedSection(state);
  const leftOverlayMode = getLeftOverlayMode(state);

  return focusedSection === SectionType.Message && leftOverlayMode === 'message-requests';
};

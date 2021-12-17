import { createSelector } from 'reselect';

import { StateType } from '../reducer';
import { OverlayMode, SectionStateType, SectionType } from '../ducks/section';
import { SessionSettingCategory } from '../../components/settings/SessionSettings';

export const getSection = (state: StateType): SectionStateType => state.section;

export const getFocusedSection = createSelector(
  getSection,
  (state: SectionStateType): SectionType => state.focusedSection
);

export const getFocusedSettingsSection = createSelector(
  getSection,
  (state: SectionStateType): SessionSettingCategory | undefined => state.focusedSettingsSection
);

export const getIsAppFocused = createSelector(
  getSection,
  (state: SectionStateType): boolean => state.isAppFocused
);

export const getOverlayMode = createSelector(
  getSection,
  (state: SectionStateType): OverlayMode => state.overlayMode
);

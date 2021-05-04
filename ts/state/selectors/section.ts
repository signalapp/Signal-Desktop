import { createSelector } from 'reselect';

import { StateType } from '../reducer';
import { SectionStateType } from '../ducks/section';
import { SectionType } from '../../components/session/ActionsPanel';
import { SessionSettingCategory } from '../../components/session/settings/SessionSettings';

export const getSection = (state: StateType): SectionStateType => state.section;

export const getFocusedSection = createSelector(
  getSection,
  (state: SectionStateType): SectionType => state.focusedSection
);

export const getFocusedSettingsSection = createSelector(
  getSection,
  (state: SectionStateType): SessionSettingCategory | undefined => state.focusedSettingsSection
);

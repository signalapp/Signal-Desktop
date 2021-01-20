import { createSelector } from 'reselect';

import { StateType } from '../reducer';
import { SectionStateType } from '../ducks/section';
import { SectionType } from '../../components/session/ActionsPanel';

export const getSection = (state: StateType): SectionStateType => state.section;

export const getFocusedSection = createSelector(
  getSection,
  (state: SectionStateType): SectionType => state.focusedSection
);

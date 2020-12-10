import { SectionType } from '../../components/session/ActionsPanel';

export const FOCUS_SECTION = 'FOCUS_SECTION';

type FocusSectionActionType = {
  type: 'FOCUS_SECTION';
  payload: SectionType;
};

function focusSection(section: SectionType): FocusSectionActionType {
  return {
    type: FOCUS_SECTION,
    payload: section,
  };
}

export const actions = {
  focusSection,
};

const initialState = { focusedSection: SectionType.Message };
export type SectionStateType = {
  focusedSection: SectionType;
};

export const reducer = (
  state: any = initialState,
  {
    type,
    payload,
  }: {
    type: string;
    payload: SectionType;
  }
): SectionStateType => {
  switch (type) {
    case FOCUS_SECTION:
      return { focusedSection: payload };
    default:
      return state;
  }
};

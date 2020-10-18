import { SectionType } from '../../components/session/ActionsPanel';

export const FOCUS_SECTION = 'FOCUS_SECTION';

const focusSection = (section: SectionType) => {
  return {
    type: FOCUS_SECTION,
    payload: section,
  };
};

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

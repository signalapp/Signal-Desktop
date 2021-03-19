import { SectionType } from '../../components/session/ActionsPanel';
import { SessionSettingCategory } from '../../components/session/settings/SessionSettings';

export const FOCUS_SECTION = 'FOCUS_SECTION';
export const FOCUS_SETTINGS_SECTION = 'FOCUS_SETTINGS_SECTION';

type FocusSectionActionType = {
  type: 'FOCUS_SECTION';
  payload: SectionType;
};

type FocusSettingsSectionActionType = {
  type: 'FOCUS_SETTINGS_SECTION';
  payload: SessionSettingCategory;
};

export function showLeftPaneSection(
  section: SectionType
): FocusSectionActionType {
  return {
    type: FOCUS_SECTION,
    payload: section,
  };
}

type SectionActionTypes =
  | FocusSectionActionType
  | FocusSettingsSectionActionType;

export function showSettingsSection(
  category: SessionSettingCategory
): FocusSettingsSectionActionType {
  return {
    type: FOCUS_SETTINGS_SECTION,
    payload: category,
  };
}

export const actions = {
  showLeftPaneSection,
  showSettingsSection,
};

const initialState = {
  focusedSection: SectionType.Message,
  focusedSettingsSection: undefined,
};

export type SectionStateType = {
  focusedSection: SectionType;
  focusedSettingsSection?: SessionSettingCategory;
};

export const reducer = (
  state: any = initialState,
  {
    type,
    payload,
  }: {
    type: string;
    payload: SectionActionTypes;
  }
): SectionStateType => {
  switch (type) {
    case FOCUS_SECTION:
      // if we change to something else than settings, reset the focused settings section
      const castedPayload = (payload as unknown) as SectionType;

      if (castedPayload !== SectionType.Settings) {
        return {
          focusedSection: castedPayload,
          focusedSettingsSection: undefined,
        };
      }

      // on click on the gear icon: show the appearance tab by default
      return {
        ...state,
        focusedSection: payload,
        focusedSettingsSection: SessionSettingCategory.Appearance,
      };
    case FOCUS_SETTINGS_SECTION:
      return {
        ...state,
        focusedSettingsSection: payload,
      };
    default:
      return state;
  }
};

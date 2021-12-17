import { SessionSettingCategory } from '../../components/settings/SessionSettings';

export const FOCUS_SECTION = 'FOCUS_SECTION';
export const FOCUS_SETTINGS_SECTION = 'FOCUS_SETTINGS_SECTION';
export const IS_APP_FOCUSED = 'IS_APP_FOCUSED';
export const OVERLAY_MODE = 'OVERLAY_MODE';

export enum SectionType {
  Profile,
  Message,
  Contact,
  Settings,
  Moon,
  PathIndicator,
}

type FocusSectionActionType = {
  type: 'FOCUS_SECTION';
  payload: SectionType;
};

type FocusSettingsSectionActionType = {
  type: 'FOCUS_SETTINGS_SECTION';
  payload: SessionSettingCategory;
};

type IsAppFocusedActionType = {
  type: 'IS_APP_FOCUSED';
  payload: boolean;
};

type OverlayModeActionType = {
  type: 'OVERLAY_MODE';
  payload: OverlayMode;
};

export function showLeftPaneSection(section: SectionType): FocusSectionActionType {
  return {
    type: FOCUS_SECTION,
    payload: section,
  };
}

type SectionActionTypes = FocusSectionActionType | FocusSettingsSectionActionType;

export function setIsAppFocused(focused: boolean): IsAppFocusedActionType {
  return {
    type: IS_APP_FOCUSED,
    payload: focused,
  };
}

export type OverlayMode =
  | 'message'
  | 'open-group'
  | 'closed-group'
  | 'message-requests'
  | undefined;

export function setOverlayMode(overlayMode: OverlayMode): OverlayModeActionType {
  return {
    type: OVERLAY_MODE,
    payload: overlayMode,
  };
}

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
  setOverlayMode,
};

export const initialSectionState: SectionStateType = {
  focusedSection: SectionType.Message,
  focusedSettingsSection: undefined,
  isAppFocused: false,
  overlayMode: undefined,
};

export type SectionStateType = {
  focusedSection: SectionType;
  focusedSettingsSection?: SessionSettingCategory;
  isAppFocused: boolean;
  overlayMode: OverlayMode;
};

export const reducer = (
  state: any = initialSectionState,
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
          ...state,
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

    case IS_APP_FOCUSED:
      return {
        ...state,
        isAppFocused: payload,
      };
    case OVERLAY_MODE:
      return {
        ...state,
        overlayMode: payload,
      };
    default:
      return state;
  }
};

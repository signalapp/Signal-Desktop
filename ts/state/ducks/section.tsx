// TODOLATER move into redux slice
import { SessionSettingCategory } from '../../components/settings/SessionSettings';

export const FOCUS_SECTION = 'FOCUS_SECTION';
export const FOCUS_SETTINGS_SECTION = 'FOCUS_SETTINGS_SECTION';
export const IS_APP_FOCUSED = 'IS_APP_FOCUSED';
export const OVERLAY_MODE = 'OVERLAY_MODE';
export const RESET_OVERLAY_MODE = 'RESET_OVERLAY_MODE';
export const RIGHT_OVERLAY_MODE = 'RIGHT_OVERLAY_MODE';
export const RESET_RIGHT_OVERLAY_MODE = 'RESET_RIGHT_OVERLAY_MODE';

export enum SectionType {
  Profile,
  Message,
  Settings,
  ColorMode,
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

type ResetOverlayModeActionType = {
  type: 'RESET_OVERLAY_MODE';
};

type RightOverlayModeActionType = {
  type: 'RIGHT_OVERLAY_MODE';
  payload: RightOverlayMode;
};

type ResetRightOverlayModeActionType = {
  type: 'RESET_RIGHT_OVERLAY_MODE';
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

// TODO Should be renamed to LeftOverlayMode
export type OverlayMode =
  | 'choose-action'
  | 'message'
  | 'open-group'
  | 'closed-group'
  | 'message-requests';

export function setOverlayMode(overlayMode: OverlayMode): OverlayModeActionType {
  return {
    type: OVERLAY_MODE,
    payload: overlayMode,
  };
}

export function resetOverlayMode(): ResetOverlayModeActionType {
  return {
    type: RESET_OVERLAY_MODE,
  };
}

// TODO possibly more overlays here
export type RightOverlayMode = 'disappearing-messages';

export function setRightOverlayMode(overlayMode: RightOverlayMode): RightOverlayModeActionType {
  return {
    type: RIGHT_OVERLAY_MODE,
    payload: overlayMode,
  };
}

export function resetRightOverlayMode(): ResetRightOverlayModeActionType {
  return {
    type: RESET_RIGHT_OVERLAY_MODE,
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
  resetOverlayMode,
  setRightOverlayMode,
  resetRightOverlayMode,
};

export const initialSectionState: SectionStateType = {
  focusedSection: SectionType.Message,
  focusedSettingsSection: undefined,
  isAppFocused: false,
  overlayMode: undefined,
  rightOverlayMode: undefined,
};

export type SectionStateType = {
  focusedSection: SectionType;
  focusedSettingsSection?: SessionSettingCategory;
  isAppFocused: boolean;
  overlayMode: OverlayMode | undefined;
  rightOverlayMode: RightOverlayMode | undefined;
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
      // eslint-disable-next-line no-case-declarations
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
        focusedSettingsSection: SessionSettingCategory.Privacy,
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
    case RESET_OVERLAY_MODE:
      return {
        ...state,
        overlayMode: undefined,
      };
    case RIGHT_OVERLAY_MODE:
      return {
        ...state,
        rightOverlayMode: payload,
      };
    case RESET_RIGHT_OVERLAY_MODE:
      return {
        ...state,
        rightOverlayMode: undefined,
      };
    default:
      return state;
  }
};

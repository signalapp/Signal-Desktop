// TODO move into redux slice

import type { SessionSettingCategory } from '../../types/ReduxTypes';

export const FOCUS_SECTION = 'FOCUS_SECTION';
export const FOCUS_SETTINGS_SECTION = 'FOCUS_SETTINGS_SECTION';
export const IS_APP_FOCUSED = 'IS_APP_FOCUSED';
export const LEFT_OVERLAY_MODE = 'LEFT_OVERLAY_MODE';
export const RESET_LEFT_OVERLAY_MODE = 'RESET_OVERLAY_MODE';
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

type LeftOverlayModeActionType = {
  type: 'LEFT_OVERLAY_MODE';
  payload: LeftOverlayMode;
};

type ResetLeftOverlayModeActionType = {
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

export type LeftOverlayMode =
  | 'choose-action'
  | 'message'
  | 'open-group'
  | 'closed-group'
  | 'message-requests';

export function setLeftOverlayMode(overlayMode: LeftOverlayMode): LeftOverlayModeActionType {
  return {
    type: LEFT_OVERLAY_MODE,
    payload: overlayMode,
  };
}

export function resetLeftOverlayMode(): ResetLeftOverlayModeActionType {
  return {
    type: RESET_LEFT_OVERLAY_MODE,
  };
}

type RightPanelDefaultState = { type: 'default'; params: null };
type RightPanelMessageInfoState = {
  type: 'message_info';
  params: { messageId: string; visibleAttachmentIndex: number | undefined };
};
type RightPanelDisappearingMessagesState = { type: 'disappearing_messages'; params: null };

export type RightOverlayMode =
  | RightPanelDefaultState
  | RightPanelMessageInfoState
  | RightPanelDisappearingMessagesState;

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
  setLeftOverlayMode,
  resetLeftOverlayMode,
  setRightOverlayMode,
  resetRightOverlayMode,
};

export const initialSectionState: SectionStateType = {
  focusedSection: SectionType.Message,
  focusedSettingsSection: undefined,
  isAppFocused: false,
  leftOverlayMode: undefined,
  rightOverlayMode: { type: 'default', params: null },
};

export type SectionStateType = {
  focusedSection: SectionType;
  focusedSettingsSection?: SessionSettingCategory;
  isAppFocused: boolean;
  leftOverlayMode: LeftOverlayMode | undefined;
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
      const castedPayload = payload as unknown as SectionType;

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
        focusedSettingsSection: 'privacy',
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
    case LEFT_OVERLAY_MODE:
      return {
        ...state,
        leftOverlayMode: payload,
      };
    case RESET_LEFT_OVERLAY_MODE:
      return {
        ...state,
        leftOverlayMode: undefined,
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

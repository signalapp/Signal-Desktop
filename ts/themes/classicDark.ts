import { hexColorToRGB } from '../util/hexColorToRGB';
import { COLORS, THEMES } from './constants/colors';
import { ThemeColorVariables } from './variableColors';

export const classicDark: ThemeColorVariables = {
  '--danger-color': THEMES.CLASSIC_DARK.DANGER,
  '--disabled-color': THEMES.CLASSIC_DARK.DISABLED,

  '--background-primary-color': THEMES.CLASSIC_DARK.COLOR1,
  '--background-secondary-color': THEMES.CLASSIC_DARK.COLOR0,

  '--text-primary-color': THEMES.CLASSIC_DARK.COLOR6,
  '--text-secondary-color': THEMES.CLASSIC_DARK.COLOR5,
  '--text-selection-color': `rgba(${hexColorToRGB(THEMES.CLASSIC_DARK.COLOR6)}, 0.5)`,

  '--border-color': THEMES.CLASSIC_DARK.COLOR3,

  '--text-box-background-color': 'var(--background-secondary-color)',
  '--text-box-text-control-color': 'var(--text-secondary-color)',
  '--text-box-text-user-color': 'var(--text-primary-color)',
  '--text-box-border-color': 'var(--border-color)',

  '--message-bubbles-sent-background-color': 'var(--primary-color)',
  '--message-bubbles-received-background-color': THEMES.CLASSIC_DARK.COLOR2,
  '--message-bubbles-sent-text-color': 'var(--background-primary-color)',
  '--message-bubbles-received-text-color': 'var(--text-primary-color)',

  '--menu-button-background-color': 'var(--primary-color)',
  '--menu-button-background-hover-color': THEMES.CLASSIC_DARK.COLOR4,
  '--menu-button-icon-color': THEMES.CLASSIC_DARK.COLOR6,

  '--chat-buttons-background-color': THEMES.CLASSIC_DARK.COLOR2,
  '--chat-buttons-background-hover-color': THEMES.CLASSIC_DARK.COLOR3,
  '--chat-buttons-icon-color': 'var(--text-primary-color)',

  '--settings-tab-background-color': 'var(--background-primary-color)',
  '--settings-tab-background-hover-color': THEMES.CLASSIC_DARK.COLOR2,
  '--settings-tab-background-selected-color': THEMES.CLASSIC_DARK.COLOR3,
  '--settings-tab-text-color': 'var(--text-primary-color)',

  '--button-outline-background-color': 'var(--transparent-color)',
  '--button-outline-background-hover-color': `rgba(${hexColorToRGB(
    THEMES.CLASSIC_DARK.COLOR6
  )}, 0.3)`,
  '--button-outline-text-color': 'var(--primary-color)',
  '--button-outline-text-hover-color': 'var(--text-primary-color)',
  '--button-outline-border-color': 'var(--primary-color)',
  '--button-outline-border-hover-color': 'var(--text-primary-color)',
  '--button-outline-disabled-color': 'var(--disabled-color)',

  '--button-solid-background-color': THEMES.CLASSIC_DARK.COLOR3,
  '--button-solid-background-hover-color': THEMES.CLASSIC_DARK.COLOR4,
  '--button-solid-text-color': 'var(--text-primary-color)',
  '--button-solid-text-hover-color': 'var(--text-primary-color)',
  '--button-solid-disabled-color': THEMES.CLASSIC_DARK.COLOR4,
  '--button-solid-shadow-color': 'none',

  '--button-simple-text-color': 'var(--text-primary-color)',
  '--button-simple-disabled-color': 'var(--disabled-color)',

  '--button-icon-background-color': 'var(--transparent-color)',
  '--button-icon-stroke-color': 'var(--text-secondary-color)',
  '--button-icon-stroke-hover-color': 'var(--text-primary-color)',
  '--button-icon-stroke-selected-color': 'var(--text-primary-color)',

  '--conversation-tab-background-color': 'var(--background-primary-color)',
  '--conversation-tab-background-hover-color': THEMES.CLASSIC_DARK.COLOR3,
  '--conversation-tab-background-selected-color': THEMES.CLASSIC_DARK.COLOR3,
  '--conversation-tab-background-unread-color': THEMES.CLASSIC_DARK.COLOR2,
  '--conversation-tab-text-color': 'var(--text-secondary-color)',
  '--conversation-tab-text-selected-color': 'var(--text-primary-color)',
  '--conversation-tab-text-unread-color': 'var(--text-primary-color)',
  '--conversation-tab-text-secondary-color': 'var(--text-secondary-color)',
  '--conversation-tab-bubble-background-color': THEMES.CLASSIC_DARK.COLOR3,
  '--conversation-tab-bubble-text-color': 'var(--text-primary-color)',
  '--conversation-tab-color-strip-color': 'var(--primary-color)',

  '--search-bar-background-color': 'var(--background-secondary-color)',
  '--search-bar-text-control-color': 'var(--text-secondary-color)',
  '--search-bar-text-user-color': 'var(--text-primary-color)',
  '--search-bar-icon-color': 'var(--text-secondary-color)',
  '--search-bar-icon-hover-color': 'var(--text-primary-color)',

  '--scroll-bar-track-color': 'none',
  '--scroll-bar-thumb-color': THEMES.CLASSIC_DARK.COLOR3,
  '--scroll-bar-thumb-hover-color': THEMES.CLASSIC_DARK.COLOR4,

  '--zoom-bar-track-color': THEMES.CLASSIC_DARK.COLOR3,
  '--zoom-bar-thumb-color': 'var(--primary-color)',
  '--zoom-bar-interval-color': 'var(--primary-color)',

  '--toggle-switch-ball-color': 'var(--white-color)',
  '--toggle-switch-ball-shadow-color': `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.15)`,
  '--toggle-switch-off-background-color': 'var(--transparent-color)',
  '--toggle-switch-off-border-color': 'var(--white-color)',
  '--toggle-switch-on-background-color': 'var(--primary-color)',
  '--toggle-switch-on-border-color': 'var(--transparent-color)',

  '--unread-messages-alert-background-color': 'var(--primary-color)',
  '--unread-messages-alert-text-color': THEMES.CLASSIC_DARK.COLOR0,

  '--button-color-mode-stroke-color': 'var(--text-primary-color)',
  '--button-color-mode-hover-color': 'var(--text-primary-color)',
  '--button-color-mode-fill-color': 'var(--text-primary-color)',

  '--emoji-reaction-bar-background-color': THEMES.CLASSIC_DARK.COLOR2,
  '--emoji-reaction-bar-icon-background-color': 'var(--background-secondary-color)',
  '--emoji-reaction-bar-icon-color': 'var(--text-primary-color)',

  '--modal-background-content-color': 'var(--background-primary-color)',
  '--modal-text-color': 'var(--text-primary-color)',
  '--modal-text-danger-color': 'var(--danger-color)',

  '--toast-background-color': 'var(--background-primary-color)',
  '--toast-text-color': 'var(--text-primary-color)',
  '--toast-color-strip-color': 'var(--primary-color)',
  '--toast-progress-color': `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.1)`,

  '--right-panel-item-background-color': THEMES.CLASSIC_DARK.COLOR2,
  '--right-panel-item-background-hover-color': THEMES.CLASSIC_DARK.COLOR3,
  '--right-panel-item-text-color': 'var(--text-primary-color)',

  '--session-logo-text-light-filter': 'none',
  '--session-logo-text-dark-filter': 'none',
  '--session-logo-text-current-filter': 'var(--session-logo-text-light-filter)',

  '--context-menu-background-color': 'var(--background-primary-color)',
  '--context-menu-background-hover-color': 'var(--primary-color)',
  '--context-menu-text-color': 'var(--text-primary-color)',
  '--context-menu-text-hover-color': 'var(--black-color)',

  '--suggestions-background-color': THEMES.CLASSIC_DARK.COLOR2,
  '--suggestions-background-hover-color': THEMES.CLASSIC_DARK.COLOR3,
  '--suggestions-text-color': 'var(--text-primary-color)',
  '--suggestions-shadow': `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.24) 0px 3px 8px`,

  '--input-background-color': 'var(--transparent-color)',
  '--input-background-hover-color': 'var(--background-primary-color)',
  '--input-text-placeholder-color': 'var(--text-secondary-color)',
  '--input-text-color': 'var(--text-primary-color)',
  '--input-border-color': 'var(--border-color)',

  '--in-call-container-background-color': 'var(--background-primary-color)',
  '--in-call-container-text-color': 'var(--text-primary-color)',

  '--call-buttons-background-color': THEMES.CLASSIC_DARK.COLOR3,
  '--call-buttons-background-hover-color': THEMES.CLASSIC_DARK.COLOR4,
  '--call-buttons-background-disabled-color': THEMES.CLASSIC_DARK.COLOR2,
  '--call-buttons-action-background-color': 'var(--white-color)',
  '--call-buttons-action-background-hover-color': `rgba(${hexColorToRGB(COLORS.WHITE)}, 0.87)`,
  '--call-buttons-action-icon-color': 'var(--black-color)',
  '--call-buttons-icon-color': 'var(--text-primary-color)',
  '--call-buttons-icon-disabled-color': 'var(--text-primary-color)',
  '--call-buttons-dropdown-color': 'var(--text-primary-color)',
  '--call-buttons-dropdown-shadow': '0 0 4px 0 var(grey-color)',

  '--file-dropzone-background-color': 'var(--message-link-preview-background-color)',
  '--file-dropzone-border-color': 'var(--primary-color)',
};

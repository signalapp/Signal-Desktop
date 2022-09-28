import { hexColorToRGB } from '../util/hexColorToRGB';
import { COLORS, PrimaryColorStateType, THEMES, ThemeStateType } from './colors';

function loadClassicLight(primaryColor?: PrimaryColorStateType) {
  document.documentElement.style.setProperty(
    '--primary-color',
    primaryColor && primaryColor !== THEMES.CLASSIC_LIGHT.PRIMARY
      ? primaryColor
      : THEMES.CLASSIC_LIGHT.PRIMARY
  );
  document.documentElement.style.setProperty('--danger-color', THEMES.CLASSIC_LIGHT.DANGER);

  document.documentElement.style.setProperty(
    '--background-primary-color',
    THEMES.CLASSIC_LIGHT.COLOR6
  );
  document.documentElement.style.setProperty(
    '--background-secondary-color',
    THEMES.CLASSIC_LIGHT.COLOR5
  );

  document.documentElement.style.setProperty('--text-primary-color', THEMES.CLASSIC_LIGHT.COLOR0);
  document.documentElement.style.setProperty('--text-secondary-color', THEMES.CLASSIC_LIGHT.COLOR1);

  document.documentElement.style.setProperty('--border-color', THEMES.CLASSIC_LIGHT.COLOR3);

  document.documentElement.style.setProperty(
    '--text-box-background-color',
    'var(--background-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--text-box-text-control-color',
    '--text-secondary-color'
  );
  document.documentElement.style.setProperty(
    '--text-box-text-user-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--text-box-border-color',
    THEMES.CLASSIC_LIGHT.COLOR2
  );

  document.documentElement.style.setProperty(
    '--message-bubbles-sent-background-color',
    'var(--primary-color)'
  );
  document.documentElement.style.setProperty(
    '--message-bubbles-received-background-color',
    THEMES.CLASSIC_LIGHT.COLOR3
  );
  document.documentElement.style.setProperty(
    '--message-bubbles-sent-text-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--message-bubbles-received-text-color',
    'var(--text-primary-color)'
  );

  document.documentElement.style.setProperty(
    '--menu-button-background-color',
    THEMES.CLASSIC_LIGHT.COLOR0
  );
  document.documentElement.style.setProperty(
    '--menu-button-background-hover-color',
    THEMES.CLASSIC_LIGHT.COLOR1
  );
  document.documentElement.style.setProperty(
    '--menu-button-icon-color',
    THEMES.CLASSIC_LIGHT.COLOR6
  );

  document.documentElement.style.setProperty(
    '--chat-buttons-background-color',
    THEMES.CLASSIC_LIGHT.COLOR4
  );
  document.documentElement.style.setProperty(
    '--chat-buttons-background-hover-color',
    THEMES.CLASSIC_LIGHT.COLOR3
  );
  document.documentElement.style.setProperty(
    '--chat-buttons-icon-color',
    'var(--text-primary-color)'
  );

  document.documentElement.style.setProperty(
    '--settings-tab-background-color',
    'var(--background-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--settings-tab-background-hover-color',
    THEMES.CLASSIC_LIGHT.COLOR4
  );
  document.documentElement.style.setProperty(
    '--settings-tab-background-selected-color',
    THEMES.CLASSIC_LIGHT.COLOR3
  );
  document.documentElement.style.setProperty(
    '--settings-tab-text-color',
    'var(--text-primary-color)'
  );

  document.documentElement.style.setProperty(
    '--button-outline-background-color',
    'var(--transparent-color)'
  );
  document.documentElement.style.setProperty(
    '--button-outline-background-hover-color',
    `rgba(${hexColorToRGB(THEMES.CLASSIC_LIGHT.COLOR0)}, 0.1)`
  );
  document.documentElement.style.setProperty(
    '--button-outline-text-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-outline-text-hover-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-outline-border-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-outline-border-hover-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-outline-disabled-color',
    'var(--text-secondary-color)'
  );

  document.documentElement.style.setProperty(
    '--button-solid-background-color',
    'var(--background-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-solid-background-hover-color',
    THEMES.CLASSIC_LIGHT.COLOR4
  );
  document.documentElement.style.setProperty(
    '--button-solid-text-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-solid-text-hover-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-solid-disabled-color',
    THEMES.CLASSIC_LIGHT.COLOR4
  );
  document.documentElement.style.setProperty(
    '--button-solid-shadow-color',
    `rgba(${hexColorToRGB(THEMES.CLASSIC_LIGHT.COLOR0)}, 0.25)`
  );

  document.documentElement.style.setProperty(
    '--button-simple-text-color',
    'var(--text-primary-color)'
  );

  document.documentElement.style.setProperty(
    '--button-simple-disabled-color',
    'var(--text-primary-color)'
  );

  document.documentElement.style.setProperty(
    '--button-icon-background-color',
    'var(--transparent-color)'
  );
  document.documentElement.style.setProperty(
    '--button-icon-stroke-color',
    'var(--text-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-icon-stroke-hover-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-icon-stroke-selected-color',
    'var(--text-primary-color)'
  );

  document.documentElement.style.setProperty(
    '--conversation-tab-background-color',
    THEMES.CLASSIC_LIGHT.COLOR6
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-background-hover-color',
    THEMES.CLASSIC_LIGHT.COLOR4
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-background-selected-color',
    THEMES.CLASSIC_LIGHT.COLOR4
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-background-unread-color',
    'var(--background-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-text-color',
    'var(--text-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-text-selected-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-text-unread-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-text-secondary-color',
    'var(--text-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-bubble-background-color',
    THEMES.CLASSIC_LIGHT.COLOR3
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-bubble-text-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-color-strip-color',
    'var(--primary-color)'
  );

  document.documentElement.style.setProperty(
    '--search-bar-background-color',
    'var(--background-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--search-bar-text-control-color',
    'var(--text-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--search-bar-text-user-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--search-bar-icon-color',
    'var(--text-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--search-bar-icon-hover-color',
    'var(--text-primary-color)'
  );

  document.documentElement.style.setProperty(
    '--scroll-bar-fill-color',
    'var(--text-secondary-color)'
  );

  document.documentElement.style.setProperty(
    '--zoom-bar-interval-color',
    'var(--text-secondary-color)'
  );
  document.documentElement.style.setProperty('--zoom-bar-selector-color', 'var(--primary-color)');

  document.documentElement.style.setProperty('--toggle-switch-ball-color', 'var(--white-color)');
  document.documentElement.style.setProperty(
    '--toggle-switch-ball-shadow-color',
    `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.15)`
  );
  document.documentElement.style.setProperty(
    '--toggle-switch-off-background-color',
    'var(--transparent-color)'
  );
  document.documentElement.style.setProperty(
    '--toggle-switch-off-border-color',
    'var(--border-color)'
  );
  document.documentElement.style.setProperty(
    '--toggle-switch-on-background-color',
    'var(--primary-color)'
  );
  document.documentElement.style.setProperty(
    '--toggle-switch-on-border-color',
    'var(--transparent-color)'
  );

  document.documentElement.style.setProperty(
    '--unread-messages-alert-background-color',
    'var(--primary-color)'
  );
  document.documentElement.style.setProperty(
    '--unread-messages-alert-text-color',
    THEMES.CLASSIC_LIGHT.COLOR0
  );

  document.documentElement.style.setProperty(
    '--button-color-mode-stroke-color',
    'var(--text-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-color-mode-hover-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-color-mode-fill-color',
    'var(--transparent-color)'
  );

  document.documentElement.style.setProperty('--button-path-default-color', COLORS.PATH.DEFAULT);
  document.documentElement.style.setProperty(
    '--button-path-connecting-color',
    COLORS.PATH.CONNECTING
  );
  document.documentElement.style.setProperty('--button-path-error-color', COLORS.PATH.ERROR);

  document.documentElement.style.setProperty(
    '--emoji-reaction-bar-background-color',
    THEMES.CLASSIC_LIGHT.COLOR4
  );
  document.documentElement.style.setProperty(
    '--emoji-reaction-bar-icon-background-color',
    'var(--background-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--emoji-reaction-bar-icon-color',
    'var(--text-primary-color)'
  );

  document.documentElement.style.setProperty(
    '--modal-background-color',
    THEMES.CLASSIC_LIGHT.COLOR6
  );
  document.documentElement.style.setProperty('--modal-text-color', 'var(--text-primary-color)');
  document.documentElement.style.setProperty('--modal-text-danger-color', 'var(--danger-color)');

  document.documentElement.style.setProperty(
    '--toast-progress-color',
    `rgba(${hexColorToRGB(THEMES.CLASSIC_LIGHT.COLOR0)}, 0.1)`
  );

  document.documentElement.style.setProperty(
    '--right-panel-item-background-color',
    'var(--background-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--right-panel-item-background-hover-color',
    THEMES.CLASSIC_LIGHT.COLOR4
  );
  document.documentElement.style.setProperty(
    '--right-panel-item-text-color',
    'var(--text-primary-color)'
  );

  document.documentElement.style.setProperty(
    '--session-logo-text-light-filter',
    'brightness(0) saturate(100%)'
  );
  document.documentElement.style.setProperty('--session-logo-text-dark-filter', 'none');
  document.documentElement.style.setProperty(
    '--session-logo-text-current-filter',
    'var(--session-logo-text-light-filter)'
  );

  document.documentElement.style.setProperty(
    '--context-menu-background-color',
    'var(--background-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--context-menu-background-hover-color',
    'var(--primary-color)'
  );
  document.documentElement.style.setProperty(
    '--context-menu-text-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--context-menu-text-hover-color',
    'var(--black-color)'
  );
  document.documentElement.style.setProperty(
    '--context-menu-shadow-color',
    `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.22)`
  );

  document.documentElement.style.setProperty(
    '--message-link-preview-background-color',
    `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.06)`
  );
}

function loadClassicDark(primaryColor?: PrimaryColorStateType) {
  document.documentElement.style.setProperty(
    '--primary-color',
    primaryColor && primaryColor !== THEMES.CLASSIC_DARK.PRIMARY
      ? primaryColor
      : THEMES.CLASSIC_DARK.PRIMARY
  );
  document.documentElement.style.setProperty('--danger-color', THEMES.CLASSIC_DARK.DANGER);

  document.documentElement.style.setProperty(
    '--background-primary-color',
    THEMES.CLASSIC_DARK.COLOR1
  );
  document.documentElement.style.setProperty(
    '--background-secondary-color',
    THEMES.CLASSIC_DARK.COLOR0
  );

  document.documentElement.style.setProperty('--text-primary-color', THEMES.CLASSIC_DARK.COLOR6);
  document.documentElement.style.setProperty('--text-secondary-color', THEMES.CLASSIC_DARK.COLOR5);

  document.documentElement.style.setProperty('--border-color', THEMES.CLASSIC_DARK.COLOR3);

  document.documentElement.style.setProperty(
    '--text-box-background-color',
    'var(--background-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--text-box-text-control-color',
    'var(--text-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--text-box-text-user-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty('--text-box-border-color', 'var(--border-color)');

  document.documentElement.style.setProperty(
    '--message-bubbles-sent-background-color',
    'var(--primary-color)'
  );
  document.documentElement.style.setProperty(
    '--message-bubbles-received-background-color',
    THEMES.CLASSIC_DARK.COLOR2
  );
  document.documentElement.style.setProperty(
    '--message-bubbles-sent-text-color',
    'var(--background-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--message-bubbles-received-text-color',
    'var(--text-primary-color)'
  );

  document.documentElement.style.setProperty(
    '--menu-button-background-color',
    'var(--primary-color)'
  );
  document.documentElement.style.setProperty(
    '--menu-button-background-hover-color',
    THEMES.CLASSIC_DARK.COLOR4
  );
  document.documentElement.style.setProperty(
    '--menu-button-icon-color',
    THEMES.CLASSIC_DARK.COLOR6
  );

  document.documentElement.style.setProperty(
    '--chat-buttons-background-color',
    THEMES.CLASSIC_DARK.COLOR2
  );
  document.documentElement.style.setProperty(
    '--chat-buttons-background-hover-color',
    THEMES.CLASSIC_DARK.COLOR3
  );
  document.documentElement.style.setProperty(
    '--chat-buttons-icon-color',
    'var(--text-primary-color)'
  );

  document.documentElement.style.setProperty(
    '--settings-tab-background-color',
    'var(--background-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--settings-tab-background-hover-color',
    THEMES.CLASSIC_DARK.COLOR2
  );
  document.documentElement.style.setProperty(
    '--settings-tab-background-selected-color',
    THEMES.CLASSIC_DARK.COLOR3
  );
  document.documentElement.style.setProperty(
    '--settings-tab-text-color',
    'var(--text-primary-color)'
  );

  document.documentElement.style.setProperty(
    '--button-outline-background-color',
    'var(--transparent-color)'
  );
  document.documentElement.style.setProperty(
    '--button-outline-background-hover-color',
    `rgba(${hexColorToRGB(THEMES.CLASSIC_DARK.COLOR6)}, 0.3)`
  );
  document.documentElement.style.setProperty('--button-outline-text-color', 'var(--primary-color)');
  document.documentElement.style.setProperty(
    '--button-outline-text-hover-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-outline-border-color',
    'var(--primary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-outline-border-hover-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-outline-disabled-color',
    'var(--text-secondary-color)'
  );

  document.documentElement.style.setProperty(
    '--button-solid-background-color',
    THEMES.CLASSIC_DARK.COLOR3
  );
  document.documentElement.style.setProperty(
    '--button-solid-background-hover-color',
    THEMES.CLASSIC_DARK.COLOR4
  );
  document.documentElement.style.setProperty(
    '--button-solid-text-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-solid-text-hover-color',
    'var(--text-primary-color)'
  );
  // TODO Theming - Confirm this
  document.documentElement.style.setProperty(
    '--button-solid-disabled-color',
    THEMES.CLASSIC_DARK.COLOR4
  );
  document.documentElement.style.setProperty('--button-solid-shadow-color', 'none');

  document.documentElement.style.setProperty(
    '--button-simple-text-color',
    'var(--text-primary-color)'
  );

  document.documentElement.style.setProperty(
    '--button-simple-disabled-color',
    'var(--text-primary-color)'
  );

  document.documentElement.style.setProperty(
    '--button-icon-background-color',
    'var(--transparent-color)'
  );
  document.documentElement.style.setProperty(
    '--button-icon-stroke-color',
    'var(--text-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-icon-stroke-hover-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-icon-stroke-selected-color',
    'var(--text-primary-color)'
  );

  document.documentElement.style.setProperty(
    '--conversation-tab-background-color',
    'var(--background-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-background-hover-color',
    THEMES.CLASSIC_DARK.COLOR2
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-background-selected-color',
    THEMES.CLASSIC_DARK.COLOR3
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-background-unread-color',
    THEMES.CLASSIC_DARK.COLOR2
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-text-color',
    'var(--text-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-text-selected-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-text-unread-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-text-secondary-color',
    'var(--text-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-bubble-background-color',
    THEMES.CLASSIC_DARK.COLOR3
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-bubble-text-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-color-strip-color',
    'var(--primary-color)'
  );

  document.documentElement.style.setProperty(
    '--search-bar-background-color',
    'var(--background-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--search-bar-text-control-color',
    'var(--text-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--search-bar-text-user-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--search-bar-icon-color',
    'var(--text-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--search-bar-icon-hover-color',
    'var(--text-primary-color)'
  );

  document.documentElement.style.setProperty('--scroll-bar-fill-color', THEMES.CLASSIC_DARK.COLOR4);

  document.documentElement.style.setProperty(
    '--zoom-bar-interval-color',
    THEMES.CLASSIC_DARK.COLOR4
  );
  document.documentElement.style.setProperty('--zoom-bar-selector-color', 'var(--primary-color)');

  document.documentElement.style.setProperty('--toggle-switch-ball-color', 'var(--white-color)');
  document.documentElement.style.setProperty(
    '--toggle-switch-ball-shadow-color',
    `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.15)`
  );
  document.documentElement.style.setProperty(
    '--toggle-switch-off-background-color',
    'var(--transparent-color)'
  );
  document.documentElement.style.setProperty(
    '--toggle-switch-off-border-color',
    'var(--white-color)'
  );
  document.documentElement.style.setProperty(
    '--toggle-switch-on-background-color',
    'var(--primary-color)'
  );
  document.documentElement.style.setProperty(
    '--toggle-switch-on-border-color',
    'var(--transparent-color)'
  );

  document.documentElement.style.setProperty(
    '--unread-messages-alert-background-color',
    'var(--primary-color)'
  );
  document.documentElement.style.setProperty(
    '--unread-messages-alert-text-color',
    THEMES.CLASSIC_DARK.COLOR0
  );

  document.documentElement.style.setProperty(
    '--button-color-mode-stroke-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-color-mode-hover-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-color-mode-fill-color',
    'var(--text-primary-color)'
  );

  // TODO Theming - Probably can remove this?
  document.documentElement.style.setProperty('--button-path-default-color', COLORS.PATH.DEFAULT);
  document.documentElement.style.setProperty(
    '--button-path-connecting-color',
    COLORS.PATH.CONNECTING
  );
  document.documentElement.style.setProperty('--button-path-error-color', COLORS.PATH.ERROR);

  document.documentElement.style.setProperty(
    '--emoji-reaction-bar-background-color',
    THEMES.CLASSIC_DARK.COLOR2
  );
  document.documentElement.style.setProperty(
    '--emoji-reaction-bar-icon-background-color',
    'var(--background-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--emoji-reaction-bar-icon-color',
    'var(--text-primary-color)'
  );

  document.documentElement.style.setProperty(
    '--modal-background-color',
    'var(--background-secondary-color)'
  );
  document.documentElement.style.setProperty('--modal-text-color', 'var(--text-primary-color)');
  document.documentElement.style.setProperty('--modal-text-danger-color', 'var(--danger-color)');

  // TODO Theming - Update
  document.documentElement.style.setProperty(
    '--toast-progress-color',
    `rgba(${hexColorToRGB(THEMES.CLASSIC_DARK.COLOR0)}, 0.1)`
  );

  document.documentElement.style.setProperty(
    '--right-panel-item-background-color',
    THEMES.CLASSIC_DARK.COLOR2
  );
  document.documentElement.style.setProperty(
    '--right-panel-item-background-hover-color',
    THEMES.CLASSIC_DARK.COLOR3
  );
  document.documentElement.style.setProperty(
    '--right-panel-item-text-color',
    'var(--text-primary-color)'
  );

  document.documentElement.style.setProperty('--session-logo-text-light-filter', 'none');
  document.documentElement.style.setProperty('--session-logo-text-dark-filter', 'none');
  document.documentElement.style.setProperty(
    '--session-logo-text-current-filter',
    'var(--session-logo-text-light-filter)'
  );

  document.documentElement.style.setProperty(
    '--context-menu-background-color',
    'var(--background-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--context-menu-background-hover-color',
    'var(--primary-color)'
  );
  document.documentElement.style.setProperty(
    '--context-menu-text-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--context-menu-text-hover-color',
    'var(--black-color)'
  );
  document.documentElement.style.setProperty(
    '--context-menu-shadow-color',
    `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.22)`
  );

  document.documentElement.style.setProperty(
    '--message-link-preview-background-color',
    `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.06)`
  );
}

function loadOceanLight(primaryColor?: PrimaryColorStateType) {
  document.documentElement.style.setProperty(
    '--primary-color',
    primaryColor && primaryColor !== THEMES.OCEAN_LIGHT.PRIMARY
      ? primaryColor
      : THEMES.OCEAN_LIGHT.PRIMARY
  );
  document.documentElement.style.setProperty('--danger-color', THEMES.OCEAN_LIGHT.DANGER);

  document.documentElement.style.setProperty(
    '--background-primary-color',
    THEMES.OCEAN_LIGHT.COLOR7!
  );
  document.documentElement.style.setProperty(
    '--background-secondary-color',
    THEMES.OCEAN_LIGHT.COLOR6
  );

  document.documentElement.style.setProperty('--text-primary-color', THEMES.OCEAN_LIGHT.COLOR1);
  document.documentElement.style.setProperty('--text-secondary-color', THEMES.OCEAN_LIGHT.COLOR2);

  document.documentElement.style.setProperty('--border-color', THEMES.OCEAN_LIGHT.COLOR3);

  document.documentElement.style.setProperty(
    '--text-box-background-color',
    'var(--background-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--text-box-text-control-color',
    '--text-secondary-color'
  );
  document.documentElement.style.setProperty(
    '--text-box-text-user-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty('--text-box-border-color', 'var(--border-color)');

  document.documentElement.style.setProperty(
    '--message-bubbles-sent-background-color',
    'var(--primary-color)'
  );
  document.documentElement.style.setProperty(
    '--message-bubbles-received-background-color',
    THEMES.OCEAN_LIGHT.COLOR4
  );
  document.documentElement.style.setProperty(
    '--message-bubbles-sent-text-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--message-bubbles-received-text-color',
    'var(--text-primary-color)'
  );

  document.documentElement.style.setProperty(
    '--menu-button-background-color',
    'var(--primary-color)'
  );
  document.documentElement.style.setProperty(
    '--menu-button-background-hover-color',
    THEMES.OCEAN_LIGHT.COLOR3
  );
  document.documentElement.style.setProperty('--menu-button-icon-color', THEMES.OCEAN_LIGHT.COLOR1);

  document.documentElement.style.setProperty(
    '--chat-buttons-background-color',
    THEMES.OCEAN_LIGHT.COLOR5
  );
  document.documentElement.style.setProperty(
    '--chat-buttons-background-hover-color',
    THEMES.OCEAN_LIGHT.COLOR3
  );
  document.documentElement.style.setProperty(
    '--chat-buttons-icon-color',
    'var(--text-primary-color)'
  );

  document.documentElement.style.setProperty(
    '--settings-tab-background-color',
    'var(--background-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--settings-tab-background-hover-color',
    THEMES.OCEAN_LIGHT.COLOR6
  );
  document.documentElement.style.setProperty(
    '--settings-tab-background-selected-color',
    THEMES.OCEAN_LIGHT.COLOR5
  );
  document.documentElement.style.setProperty(
    '--settings-tab-text-color',
    'var(--text-primary-color)'
  );

  document.documentElement.style.setProperty(
    '--button-outline-background-color',
    'var(--transparent-color)'
  );
  document.documentElement.style.setProperty(
    '--button-outline-background-hover-color',
    `rgba(${hexColorToRGB(THEMES.OCEAN_LIGHT.COLOR0)}, 0.1)`
  );
  document.documentElement.style.setProperty(
    '--button-outline-text-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-outline-text-hover-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-outline-border-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-outline-border-hover-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-outline-disabled-color',
    'var(--text-secondary-color)'
  );

  document.documentElement.style.setProperty(
    '--button-solid-background-color',
    'var(--background-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-solid-background-hover-color',
    THEMES.OCEAN_LIGHT.COLOR6
  );
  document.documentElement.style.setProperty(
    '--button-solid-text-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-solid-text-hover-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-solid-disabled-color',
    THEMES.OCEAN_LIGHT.COLOR4
  );
  document.documentElement.style.setProperty(
    '--button-solid-shadow-color',
    `rgba(${hexColorToRGB(THEMES.OCEAN_LIGHT.COLOR0)}, 0.25)`
  );

  document.documentElement.style.setProperty(
    '--button-simple-text-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-simple-disabled-color',
    'var(--text-primary-color)'
  );

  document.documentElement.style.setProperty(
    '--button-icon-background-color',
    'var(--transparent-color)'
  );
  document.documentElement.style.setProperty(
    '--button-icon-stroke-color',
    'var(--text-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-icon-stroke-hover-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-icon-stroke-selected-color',
    'var(--text-primary-color)'
  );

  document.documentElement.style.setProperty(
    '--conversation-tab-background-color',
    'var(--background-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-background-hover-color',
    THEMES.OCEAN_LIGHT.COLOR5
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-background-selected-color',
    THEMES.OCEAN_LIGHT.COLOR5
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-background-unread-color',
    'var(--background-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-text-color',
    'var(--text-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-text-selected-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-text-unread-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-text-secondary-color',
    'var(--text-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-bubble-background-color',
    'var(--primary-color)'
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-bubble-text-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-color-strip-color',
    'var(--primary-color)'
  );

  document.documentElement.style.setProperty(
    '--search-bar-background-color',
    THEMES.OCEAN_LIGHT.COLOR5
  );
  document.documentElement.style.setProperty(
    '--search-bar-text-control-color',
    'var(--text-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--search-bar-text-user-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--search-bar-icon-color',
    'var(--text-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--search-bar-icon-hover-color',
    'var(--text-primary-color)'
  );

  document.documentElement.style.setProperty(
    '--scroll-bar-fill-color',
    'var(--text-secondary-color)'
  );

  document.documentElement.style.setProperty(
    '--zoom-bar-interval-color',
    'var(--text-secondary-color)'
  );
  document.documentElement.style.setProperty('--zoom-bar-selector-color', 'var(--primary-color)');

  document.documentElement.style.setProperty('--toggle-switch-ball-color', 'var(--white-color)');
  document.documentElement.style.setProperty(
    '--toggle-switch-ball-shadow-color',
    `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.15)`
  );
  document.documentElement.style.setProperty(
    '--toggle-switch-off-background-color',
    'var(--transparent-color)'
  );
  document.documentElement.style.setProperty(
    '--toggle-switch-off-border-color',
    'var(--border-color)'
  );
  document.documentElement.style.setProperty(
    '--toggle-switch-on-background-color',
    'var(--primary-color)'
  );
  document.documentElement.style.setProperty(
    '--toggle-switch-on-border-color',
    'var(--transparent-color)'
  );

  document.documentElement.style.setProperty(
    '--unread-messages-alert-background-color',
    'var(--primary-color)'
  );

  document.documentElement.style.setProperty(
    '--unread-messages-alert-text-color',
    THEMES.OCEAN_LIGHT.COLOR0
  );

  document.documentElement.style.setProperty(
    '--button-color-mode-stroke-color',
    'var(--text-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-color-mode-hover-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-color-mode-fill-color',
    'var(--transparent-color)'
  );

  document.documentElement.style.setProperty('--button-path-default-color', COLORS.PATH.DEFAULT);
  document.documentElement.style.setProperty(
    '--button-path-connecting-color',
    COLORS.PATH.CONNECTING
  );
  document.documentElement.style.setProperty('--button-path-error-color', COLORS.PATH.ERROR);

  document.documentElement.style.setProperty(
    '--emoji-reaction-bar-background-color',
    'var(--background-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--emoji-reaction-bar-icon-background-color',
    'var(--background-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--emoji-reaction-bar-icon-color',
    'var(--text-primary-color)'
  );

  document.documentElement.style.setProperty(
    '--modal-background-color',
    'var(--background-primary-color)'
  );
  document.documentElement.style.setProperty('--modal-text-color', 'var(--text-primary-color)');
  document.documentElement.style.setProperty('--modal-text-danger-color', 'var(--danger-color)');

  document.documentElement.style.setProperty(
    '--toast-progress-color',
    `rgba(${hexColorToRGB(THEMES.OCEAN_LIGHT.COLOR0)}, 0.1)`
  );

  document.documentElement.style.setProperty(
    '--right-panel-item-background-color',
    'var(--background-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--right-panel-item-background-hover-color',
    THEMES.OCEAN_LIGHT.COLOR4
  );
  document.documentElement.style.setProperty(
    '--right-panel-item-text-color',
    'var(--text-primary-color)'
  );

  document.documentElement.style.setProperty(
    '--session-logo-text-light-filter',
    'brightness(0) saturate(100%)'
  );
  document.documentElement.style.setProperty('--session-logo-text-dark-filter', 'none');
  document.documentElement.style.setProperty(
    '--session-logo-text-current-filter',
    'var(--session-logo-text-light-filter)'
  );

  document.documentElement.style.setProperty(
    '--context-menu-background-color',
    'var(--background-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--context-menu-background-hover-color',
    'var(--primary-color)'
  );
  document.documentElement.style.setProperty(
    '--context-menu-text-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--context-menu-text-hover-color',
    'var(--black-color)'
  );
  document.documentElement.style.setProperty(
    '--context-menu-shadow-color',
    `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.22)`
  );

  document.documentElement.style.setProperty(
    '--message-link-preview-background-color',
    `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.06)`
  );
}

function loadOceanDark(primaryColor?: PrimaryColorStateType) {
  document.documentElement.style.setProperty(
    '--primary-color',
    primaryColor && primaryColor !== THEMES.OCEAN_DARK.PRIMARY
      ? primaryColor
      : THEMES.OCEAN_DARK.PRIMARY
  );
  document.documentElement.style.setProperty('--danger-color', THEMES.OCEAN_DARK.DANGER);

  document.documentElement.style.setProperty(
    '--background-primary-color',
    THEMES.OCEAN_DARK.COLOR1
  );
  document.documentElement.style.setProperty(
    '--background-secondary-color',
    THEMES.OCEAN_DARK.COLOR2
  );

  document.documentElement.style.setProperty('--text-primary-color', THEMES.OCEAN_DARK.COLOR6);
  document.documentElement.style.setProperty('--text-secondary-color', THEMES.OCEAN_DARK.COLOR5);

  document.documentElement.style.setProperty('--border-color', THEMES.OCEAN_DARK.COLOR4);

  document.documentElement.style.setProperty(
    '--text-box-background-color',
    'var(--background-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--text-box-text-control-color',
    'var(--text-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--text-box-text-user-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty('--text-box-border-color', 'var(--border-color)');

  document.documentElement.style.setProperty(
    '--message-bubbles-sent-background-color',
    'var(--primary-color)'
  );
  document.documentElement.style.setProperty(
    '--message-bubbles-received-background-color',
    THEMES.OCEAN_DARK.COLOR4
  );
  document.documentElement.style.setProperty(
    '--message-bubbles-sent-text-color',
    THEMES.OCEAN_DARK.COLOR0
  );
  document.documentElement.style.setProperty(
    '--message-bubbles-received-text-color',
    'var(--text-primary-color)'
  );

  document.documentElement.style.setProperty(
    '--menu-button-background-color',
    'var(--primary-color)'
  );
  // TODO Theming - Update with new color #5CAACC
  document.documentElement.style.setProperty(
    '--menu-button-background-hover-color',
    THEMES.OCEAN_DARK.COLOR4
  );
  document.documentElement.style.setProperty('--menu-button-icon-color', THEMES.OCEAN_DARK.COLOR6);

  document.documentElement.style.setProperty(
    '--chat-buttons-background-color',
    THEMES.OCEAN_DARK.COLOR2
  );
  document.documentElement.style.setProperty(
    '--chat-buttons-background-hover-color',
    THEMES.OCEAN_DARK.COLOR4
  );
  document.documentElement.style.setProperty('--chat-buttons-icon-color', THEMES.OCEAN_DARK.COLOR6);

  document.documentElement.style.setProperty(
    '--settings-tab-background-color',
    'var(--background-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--settings-tab-background-hover-color',
    THEMES.OCEAN_DARK.COLOR3
  );
  // TODO Theming - Confirm
  document.documentElement.style.setProperty(
    '--settings-tab-background-selected-color',
    THEMES.OCEAN_DARK.COLOR3
  );
  document.documentElement.style.setProperty(
    '--settings-tab-text-color',
    'var(--text-primary-color)'
  );

  document.documentElement.style.setProperty(
    '--button-outline-background-color',
    'var(--transparent-color)'
  );
  document.documentElement.style.setProperty(
    '--button-outline-background-hover-color',
    `rgba(${hexColorToRGB(THEMES.OCEAN_DARK.COLOR6)}, 0.3)`
  );
  document.documentElement.style.setProperty('--button-outline-text-color', 'var(--primary-color)');
  document.documentElement.style.setProperty(
    '--button-outline-text-hover-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-outline-border-color',
    'var(--primary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-outline-border-hover-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-outline-disabled-color',
    'var(--text-primary-color)'
  );

  document.documentElement.style.setProperty(
    '--button-solid-background-color',
    'var(--background-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-solid-background-hover-color',
    THEMES.OCEAN_DARK.COLOR4
  );
  document.documentElement.style.setProperty(
    '--button-solid-text-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-solid-text-hover-color',
    'var(--text-primary-color)'
  );
  // TODO Theming - Confirm this
  document.documentElement.style.setProperty(
    '--button-solid-disabled-color',
    THEMES.OCEAN_DARK.COLOR4
  );
  document.documentElement.style.setProperty('--button-solid-shadow-color', 'none');

  document.documentElement.style.setProperty(
    '--button-simple-text-color',
    'var(--text-primary-color)'
  );

  document.documentElement.style.setProperty(
    '--button-simple-disabled-color',
    'var(--text-primary-color)'
  );

  document.documentElement.style.setProperty(
    '--button-icon-background-color',
    'var(--transparent-color)'
  );
  document.documentElement.style.setProperty(
    '--button-icon-stroke-color',
    'var(--text-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-icon-stroke-hover-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-icon-stroke-selected-color',
    'var(--text-primary-color)'
  );

  document.documentElement.style.setProperty(
    '--conversation-tab-background-color',
    'var(--background-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-background-hover-color',
    THEMES.OCEAN_DARK.COLOR3
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-background-selected-color',
    THEMES.OCEAN_DARK.COLOR3
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-background-unread-color',
    THEMES.OCEAN_DARK.COLOR2
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-text-color',
    'var(--text-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-text-selected-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-text-unread-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-text-secondary-color',
    'var(--text-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-bubble-background-color',
    'var(--primary-color)'
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-bubble-text-color',
    THEMES.OCEAN_DARK.COLOR0
  );
  document.documentElement.style.setProperty(
    '--conversation-tab-color-strip-color',
    'var(--primary-color)'
  );

  document.documentElement.style.setProperty(
    '--search-bar-background-color',
    THEMES.OCEAN_DARK.COLOR3
  );
  document.documentElement.style.setProperty(
    '--search-bar-text-control-color',
    'var(--text-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--search-bar-text-user-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--search-bar-icon-color',
    'var(--text-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--search-bar-icon-hover-color',
    'var(--text-primary-color)'
  );

  document.documentElement.style.setProperty(
    '--scroll-bar-fill-color',
    'var(text-secondary-color)'
  );

  document.documentElement.style.setProperty('--zoom-bar-interval-color', THEMES.OCEAN_DARK.COLOR4);
  document.documentElement.style.setProperty('--zoom-bar-selector-color', 'var(--primary-color)');

  document.documentElement.style.setProperty('--toggle-switch-ball-color', 'var(--white-color)');
  document.documentElement.style.setProperty(
    '--toggle-switch-ball-shadow-color',
    `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.15)`
  );
  document.documentElement.style.setProperty(
    '--toggle-switch-off-background-color',
    'var(--transparent-color)'
  );
  document.documentElement.style.setProperty(
    '--toggle-switch-off-border-color',
    'var(--white-color)'
  );
  document.documentElement.style.setProperty(
    '--toggle-switch-on-background-color',
    'var(--primary-color)'
  );
  document.documentElement.style.setProperty(
    '--toggle-switch-on-border-color',
    'var(--transparent-color)'
  );

  document.documentElement.style.setProperty(
    '--unread-messages-alert-background-color',
    'var(--primary-color)'
  );
  document.documentElement.style.setProperty(
    '--unread-messages-alert-text-color',
    THEMES.OCEAN_DARK.COLOR0
  );

  document.documentElement.style.setProperty(
    '--button-color-mode-stroke-color',
    'var(--text-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-color-mode-hover-color',
    'var(--text-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--button-color-mode-fill-color',
    'var(--text-secondary-color)'
  );

  // TODO Theming - Probably can remove this?
  document.documentElement.style.setProperty('--button-path-default-color', COLORS.PATH.DEFAULT);
  document.documentElement.style.setProperty(
    '--button-path-connecting-color',
    COLORS.PATH.CONNECTING
  );
  document.documentElement.style.setProperty('--button-path-error-color', COLORS.PATH.ERROR);

  document.documentElement.style.setProperty(
    '--emoji-reaction-bar-background-color',
    'var(--background-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--emoji-reaction-bar-icon-background-color',
    'var(--background-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--emoji-reaction-bar-icon-color',
    'var(--text-primary-color)'
  );

  document.documentElement.style.setProperty(
    '--modal-background-color',
    'var(--background-primary-color)'
  );
  document.documentElement.style.setProperty('--modal-text-color', 'var(--text-primary-color)');
  document.documentElement.style.setProperty('--modal-text-danger-color', 'var(--danger-color)');

  // TODO Theming - Update
  document.documentElement.style.setProperty(
    '--toast-progress-color',
    `rgba(${hexColorToRGB(THEMES.OCEAN_DARK.COLOR0)}, 0.1)`
  );

  document.documentElement.style.setProperty(
    '--right-panel-item-background-color',
    'var(--background-secondary-color)'
  );
  document.documentElement.style.setProperty(
    '--right-panel-item-background-hover-color',
    THEMES.OCEAN_DARK.COLOR4
  );
  document.documentElement.style.setProperty(
    '--right-panel-item-text-color',
    'var(--text-primary-color)'
  );

  document.documentElement.style.setProperty('--session-logo-text-light-filter', 'none');
  document.documentElement.style.setProperty('--session-logo-text-dark-filter', 'none');
  document.documentElement.style.setProperty(
    '--session-logo-text-current-filter',
    'var(--session-logo-text-light-filter)'
  );

  document.documentElement.style.setProperty(
    '--context-menu-background-color',
    'var(--background-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--context-menu-background-hover-color',
    'var(--primary-color)'
  );
  document.documentElement.style.setProperty(
    '--context-menu-text-color',
    'var(--text-primary-color)'
  );
  document.documentElement.style.setProperty(
    '--context-menu-text-hover-color',
    'var(--black-color)'
  );
  document.documentElement.style.setProperty(
    '--context-menu-shadow-color',
    `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.22)`
  );

  document.documentElement.style.setProperty(
    '--message-link-preview-background-color',
    `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.06)`
  );
}

export async function switchTheme(theme: ThemeStateType) {
  const selectedPrimaryColor = await window.Events.getPrimaryColorSetting();
  const primaryColor =
    (selectedPrimaryColor && (COLORS.PRIMARY as any)[`${selectedPrimaryColor.toUpperCase()}`]) ||
    null;

  switch (theme) {
    case 'classic-light':
      loadClassicLight(primaryColor);
      break;
    case 'classic-dark':
      loadClassicDark(primaryColor);
      break;
    case 'ocean-light':
      loadOceanLight(primaryColor);
      break;
    case 'ocean-dark':
      loadOceanDark(primaryColor);
      break;
    default:
      window.log.warn('Unsupported theme:', theme);
      break;
  }
}

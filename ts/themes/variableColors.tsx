// Default Theme should be Classic Dark
export type ThemeColorVariables = {
  '--primary-color': string;
  '--danger-color': string;
  '--disabled-color': string;

  /* Backgrounds */
  '--background-primary-color': string;
  '--background-secondary-color': string;

  /* Text */
  '--text-primary-color': string;
  '--text-secondary-color': string;
  '--text-selection-color': string;

  /* Borders */
  '--border-color': string;

  /* Text Box */
  '--text-box-background-color': string;
  '--text-box-text-control-color': string;
  '--text-box-text-user-color': string;
  '--text-box-border-color': string;

  /* Message Bubbles */
  '--message-bubbles-sent-background-color': string;
  '--message-bubbles-received-background-color': string;
  '--message-bubbles-sent-text-color': string;
  '--message-bubbles-received-text-color': string;

  /* Menu Button */
  '--menu-button-background-color': string;
  '--menu-button-background-hover-color': string;
  /* TODO Theming Make a icon fill varible that uses the background color? */
  '--menu-button-icon-color': string;

  /* Chat (Interaction) Buttons */
  /* Also used for Reaction Bar Buttons */
  /* Used for Link Preview Attachment Icons */
  /* Used for Media Grid Item Play Button */
  '--chat-buttons-background-color': string;
  '--chat-buttons-background-hover-color': string;
  '--chat-buttons-icon-color': string;

  /* Settings Tabs */
  '--settings-tab-background-color': string;
  '--settings-tab-background-hover-color': string;
  '--settings-tab-background-selected-color': string;
  '--settings-tab-text-color': string;

  /* TODO Theming probably consolidate this */
  /* Buttons */
  /* Outline (Default) */
  '--button-outline-background-color': string;
  '--button-outline-background-hover-color': string;
  '--button-outline-text-color': string;
  /* TODO Theming we might not need this */
  '--button-outline-text-hover-color': string;
  '--button-outline-border-color': string;
  '--button-outline-border-hover-color': string;
  '--button-outline-disabled-color': string;

  /* Solid */
  /* TODO Theming - Should Pills have their own colors */
  /* Also used for Pills */
  '--button-solid-background-color': string;
  '--button-solid-background-hover-color': string;
  '--button-solid-text-color': string;
  '--button-solid-text-hover-color': string;
  /* Solid buttons stay the same and rely on the disabled pointer */
  '--button-solid-disabled-color': string;
  /* TODO Theming - Only light themes have shadows? */
  '--button-solid-shadow-color': string;

  /* Simple */
  '--button-simple-text-color': string;
  '--button-simple-disabled-color': string;

  /* Icons */
  '--button-icon-background-color': string;
  '--button-icon-stroke-color': string;
  '--button-icon-stroke-hover-color': string;
  '--button-icon-stroke-selected-color': string;

  /* Conversation Tab */
  /* This is also user for Overlay Tabs, Contact Rows, Convesation List Items, Message Search Results, Message Requests Banner, Member List Item, Contact List Items, Message Right Click Highlighting etc. */
  '--conversation-tab-background-color': string;
  '--conversation-tab-background-hover-color': string;
  '--conversation-tab-background-selected-color': string;
  '--conversation-tab-background-unread-color': string;
  '--conversation-tab-text-color': string;
  '--conversation-tab-text-selected-color': string;
  '--conversation-tab-text-unread-color': string;
  '--conversation-tab-text-secondary-color': string;
  '--conversation-tab-bubble-background-color': string;
  '--conversation-tab-bubble-text-color': string;
  '--conversation-tab-color-strip-color': string;

  /* Search Bar */
  '--search-bar-background-color': string;
  '--search-bar-text-control-color': string;
  '--search-bar-text-user-color': string;
  '--search-bar-icon-color': string;
  '--search-bar-icon-hover-color': string;

  /* Scroll Bars */
  '--scroll-bar-track-color': string;
  '--scroll-bar-thumb-color': string;
  '--scroll-bar-thumb-hover-color': string;

  /* Zoom Bar */
  '--zoom-bar-track-color': string;
  '--zoom-bar-thumb-color': string;
  '--zoom-bar-interval-color': string;

  /* Toggle Switch */
  '--toggle-switch-ball-color': string;
  '--toggle-switch-ball-shadow-color': string;
  /* TODO Theming think this should be white instead of transparent */
  '--toggle-switch-off-background-color': string;
  '--toggle-switch-off-border-color': string;
  '--toggle-switch-on-background-color': string;
  '--toggle-switch-on-border-color': string;

  /* TODO Theming Think this is part of the Convesations Tab */
  /* Unread Messages Alert */
  '--unread-messages-alert-background-color': string;
  '--unread-messages-alert-text-color': string;

  /* toggles between the Light and Dark mode for a Theme */
  /* Color Mode Button */
  '--button-color-mode-stroke-color': string;
  '--button-color-mode-hover-color': string;
  '--button-color-mode-fill-color': string;

  /* Emoji Reaction Bar */
  '--emoji-reaction-bar-background-color': string;
  /* NOTE only used for + icon */
  '--emoji-reaction-bar-icon-background-color': string;
  '--emoji-reaction-bar-icon-color': string;

  /* TODO Theming - Should Pills have their own colors? */

  /* Modals */
  '--modal-background-content-color': string;
  '--modal-text-color': string;
  '--modal-text-danger-color': string;

  /* Toasts */
  '--toast-background-color': string;
  '--toast-text-color': string;
  '--toast-color-strip-color': string;
  '--toast-progress-color': string;

  /* Right Panel Items */
  /* Also used for Session Dropdown */
  '--right-panel-item-background-color': string;
  '--right-panel-item-background-hover-color': string;
  '--right-panel-item-text-color': string;

  /* Session Text Logo */
  /* Loads SVG as IMG and uses a filter to change color */
  '--session-logo-text-light-filter': string;
  '--session-logo-text-dark-filter': string;
  '--session-logo-text-current-filter': string;

  /* Right Click / Context Menu) */
  '--context-menu-background-color': string;
  '--context-menu-background-hover-color': string;
  '--context-menu-text-color': string;
  '--context-menu-text-hover-color': string;

  /* Message Link Preview */
  /* Also used for Images */
  /* Also used for the Media Grid Items */
  /* Also used for Staged Generic Attachments */
  /* Also used for FileDropZone */
  /* Used for Quote References Not Found */
  /* Same for all Themes */
  '--message-link-preview-background-color': string;

  /* Suggestions i.e. Mentions and Emojis */
  '--suggestions-background-color': string;
  '--suggestions-background-hover-color': string;
  '--suggestions-text-color': string;
  '--suggestions-shadow': string;

  /* Inputs */
  /* Also used for some TextAreas */
  '--input-background-color': string;
  '--input-background-hover-color': string;
  '--input-text-placeholder-color': string;
  '--input-text-color': string;
  '--input-border-color': string;
};

export function loadThemeColors(variables: ThemeColorVariables) {
  for (const [key, value] of Object.entries(variables)) {
    document.documentElement.style.setProperty(key, value);
  }
}

export = {
  // settings view
  settingsButtonSection:
    '//*[contains(@class,"session-icon-button")  and .//*[contains(@class, "gear")]]',
  settingsRowWithText: (text: string) =>
    `//*[contains(@class, "left-pane-setting-category-list-item")][contains(string(), '${text}')]`,

  leftPaneSettingsButton: '//*[contains(@class,"session-icon-button")  and .//*[contains(@class, "gear")]]',

  settingToggleWithText: (text: string) =>
    `//div[contains(@class, 'session-settings-item') and contains(string(), '${text}')]//*[contains(@class, 'session-toggle')]`,
  settingButtonWithText: (text: string) =>
    `//div[contains(@class, 'session-settings-item')]//*[contains(@class, 'session-button') and contains(string(), '${text}')]`,
  settingCategoryWithText: (text: string) =>
    `//div[contains(@class, 'left-pane-setting-category-list-item') and contains(string(), '${text}')]`,

  // Confirm is a boolean. Selects confirmation input
  passwordSetModalInput: (_confirm: boolean|undefined) =>
    `//input[@id = 'password-modal-input${_confirm ? '-confirm' : ''}']`,

  secretWordsTextInDialog:
    '//div[@class="device-pairing-dialog__secret-words"]/div[@class="subtle"]',
};

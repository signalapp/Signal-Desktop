import commonPage from './common.page';


export = {
  registrationTabSignIn:
    '//div[contains(string(), "Sign In")][contains(@class, "session-registration__tab")][contains(@role, "tab")]',

  // create new account
  createSessionIDButton: commonPage.divRoleButtonWithText('Create Session ID'),
  continueButton: commonPage.divRoleButtonWithText('Continue'),
  textareaGeneratedPubkey:
    '//textarea[contains(@class, "session-id-editable-textarea")]',
  getStartedButton: commonPage.divRoleButtonWithText('Get started'),

  // restore from seed
  restoreFromSeedMode: commonPage.divRoleButtonWithText(
    'Restore From Recovery'
  ),

  recoveryPhraseInput: commonPage.inputWithPlaceholder('Enter Recovery Phrase'),
  displayNameInput: commonPage.inputWithPlaceholder('Enter a display name'),
  passwordInput: commonPage.inputWithPlaceholder('Enter password (optional)'),
  continueSessionButton: commonPage.divRoleButtonWithText(
    'Continue Your Session'
  ),
  conversationListContainer: commonPage.divWithClass(
    'module-conversations-list-content'
  ),

  // device linking
  linkDeviceMode: commonPage.divRoleButtonWithText(
    'Link Device to Existing Session ID'
  ),
  textareaLinkDevicePubkey: commonPage.textAreaWithPlaceholder(
    'Enter your Session ID'
  ),
  linkDeviceTriggerButton: commonPage.divRoleButtonWithText('Link Device'),
  toastWrapper: '//*[contains(@class,"session-toast-wrapper")]',
  secretWordsText: '//div[contains(@class,"session-registration__content__secret-words")]/div[contains(@class,"subtle")]',
  linkWithThisDevice: commonPage.objWithClassAndText('h4', 'device-pairing-dialog__desc', 'Allow linking with this device?'),
};

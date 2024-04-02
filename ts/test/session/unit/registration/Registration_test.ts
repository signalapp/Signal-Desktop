import Sinon from 'sinon';

describe('Registration', () => {
  // TODO set mnemonic generateMnemonic() ?

  beforeEach(() => {});

  afterEach(() => {
    Sinon.restore();
  });

  describe('displayNameIsValid', () => {
    // Arrange
    // TODO different display names for testing
    // const validDisplayName = displayNameIsValid(displayName);
    // Act
    // Assert
  });

  describe('sanitizeDisplayNameOrToast', () => {
    // Arrange
    // const name = sanitizeDisplayNameOrToast(_name, setDisplayNameError, dispatch);
    // Act
    // Assert
  });

  describe('signInByLinkingDevice', () => {
    // Arrange
    // TODO generated recoverypassword
    // const abortController = new AbortController();
    // await signInByLinkingDevice(recoveryPassword, 'english', abortController.signal);
    // Act
    // Assert
    // TODO test different mnemomic errors
  });

  describe('registerSingleDevice', () => {
    // Arrange
    // await registerSingleDevice(
    //   recoveryPassword,
    //   'english',
    //   validDisplayName,
    //   async (pubkey: string) => {
    //     dispatch(setHexGeneratedPubKey(pubkey));
    //     dispatch(setDisplayName(validDisplayName));
    //     await finishRestore(pubkey, validDisplayName);
    //   }
    // );
    // Act
    // Assert
  });
});

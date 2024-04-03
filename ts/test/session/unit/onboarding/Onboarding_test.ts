import Sinon from 'sinon';

describe('Onboarding', () => {
  // stubWindowLog();
  // stubI18n();
  // TODO set mnemonic generateMnemonic() ?

  beforeEach(() => {});

  afterEach(() => {
    Sinon.restore();
  });

  describe('displayNameIsValid', () => {
    // TODO different display names for testing
    // const validDisplayName = displayNameIsValid(displayName);
    // it('it should throw an error if the display name is undefined', async () => {
    //   try {
    //     displayNameIsValid(undefined);
    //   } catch (error) {
    //     error.should.be.an.instanceOf(Error);
    //     error.message.should.equal(window.i18n('displayNameEmpty'));
    //   }
    // });
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

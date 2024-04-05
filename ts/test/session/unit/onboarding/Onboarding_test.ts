import { expect } from 'chai';
import Sinon from 'sinon';
import { displayNameIsValid } from '../../../../components/registration/utils';
import { stubI18n, stubWindowLog } from '../../../test-utils/utils';

describe('Onboarding', () => {
  stubWindowLog();
  stubI18n();
  // TODO set mnemonic generateMnemonic() ?

  beforeEach(() => {});

  afterEach(() => {
    Sinon.restore();
  });

  describe('displayNameIsValid', () => {
    it('should throw an error if the display name is undefined', async () => {
      try {
        displayNameIsValid(undefined);
      } catch (error) {
        error.should.be.an.instanceOf(Error);
        error.message.should.equal(window.i18n('displayNameEmpty'));
      }
    });
    it('should throw an error if the display name is empty after trimming', async () => {
      try {
        displayNameIsValid('    ');
      } catch (error) {
        error.should.be.an.instanceOf(Error);
        error.message.should.equal(window.i18n('displayNameEmpty'));
      }
    });
    it('if the display name is valid it should be returned', async () => {
      try {
        const displayName = 'Hello World';
        const validDisplayName = displayNameIsValid(displayName);
        expect(validDisplayName, `should equal ${displayName}`).to.equal(displayName);
      } catch (error) {
        error.should.not.be.an.instanceOf(Error);
        error.message.should.not.equal(window.i18n('displayNameEmpty'));
      }
    });
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

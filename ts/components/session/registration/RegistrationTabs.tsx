import React from 'react';

import { StringUtils, ToastUtils, UserUtils } from '../../../session/utils';
import { ConversationController } from '../../../session/conversations';
import { removeAll } from '../../../data/data';
import { SignUpTab } from './SignUpTab';
import { SignInTab } from './SignInTab';
import { TabLabel, TabType } from './TabLabel';
import { PasswordUtil } from '../../../util';
import { trigger } from '../../../shims/events';

export const MAX_USERNAME_LENGTH = 20;
// tslint:disable: use-simple-attributes

interface State {
  selectedTab: TabType;
  generatedRecoveryPhrase: string;
  hexGeneratedPubKey: string;
}

export function validatePassword(password: string, verifyPassword: string) {
  const trimmedPassword = password.trim();
  const trimmedVerifyPassword = verifyPassword.trim();
  // If user hasn't set a value then skip
  if (!trimmedPassword && !trimmedVerifyPassword) {
    return {
      passwordErrorString: '',
      passwordFieldsMatch: true,
    };
  }

  const error = PasswordUtil.validatePassword(trimmedPassword, window.i18n);
  if (error) {
    return {
      passwordErrorString: error,
      passwordFieldsMatch: true,
    };
  }

  if (trimmedPassword !== trimmedVerifyPassword) {
    return {
      passwordErrorString: '',
      passwordFieldsMatch: false,
    };
  }

  return {
    passwordErrorString: '',
    passwordFieldsMatch: true,
  };
}

export async function resetRegistration() {
  await removeAll();
  await window.storage.reset();
  await window.storage.fetch();
  ConversationController.getInstance().reset();
  await ConversationController.getInstance().load();
}

export async function signUp(signUpDetails: {
  displayName: string;
  generatedRecoveryPhrase: string;
  password: string;
  verifyPassword: string;
}) {
  const {
    displayName,
    password,
    verifyPassword,
    generatedRecoveryPhrase,
  } = signUpDetails;
  window.log.info('starting Signing up');
  const trimName = displayName.trim();

  if (!trimName) {
    window.log.warn('invalid trimmed name for registration');
    ToastUtils.pushToastError(
      'invalidDisplayName',
      window.i18n('displayNameEmpty')
    );
    return;
  }
  const passwordErrors = validatePassword(password, verifyPassword);
  if (passwordErrors.passwordErrorString) {
    window.log.warn('invalid password for registration');
    ToastUtils.pushToastError(
      'invalidPassword',
      window.i18n('invalidPassword')
    );
    return;
  }
  if (!!password && !passwordErrors.passwordFieldsMatch) {
    window.log.warn('passwords does not match for registration');
    ToastUtils.pushToastError(
      'invalidPassword',
      window.i18n('passwordsDoNotMatch')
    );
    return;
  }

  try {
    await resetRegistration();
    await window.setPassword(password);
    UserUtils.setRestoringFromSeed(false);
    await window
      .getAccountManager()
      .registerSingleDevice(generatedRecoveryPhrase, 'english', trimName);
    // We are just creating a new account, no need to wait for a configuration message
    trigger('openInbox');
  } catch (e) {
    ToastUtils.pushToastError(
      'registrationError',
      `Error: ${e.message || 'Something went wrong'}`
    );
    window.log.warn('exception during registration:', e);
  }
}

export class RegistrationTabs extends React.Component<any, State> {
  constructor() {
    super({});
    this.state = {
      selectedTab: TabType.SignUp,
      generatedRecoveryPhrase: '',
      hexGeneratedPubKey: '',
    };
  }

  public componentDidMount() {
    void this.generateMnemonicAndKeyPair();
    void resetRegistration();
  }

  public render() {
    const { selectedTab } = this.state;

    return (
      <div className="session-registration-container">
        <div className="session-registration__tab-container">
          <TabLabel
            type={TabType.SignUp}
            isSelected={selectedTab === TabType.SignUp}
            onSelect={this.handleTabSelect}
          />
          <TabLabel
            type={TabType.SignIn}
            isSelected={selectedTab === TabType.SignIn}
            onSelect={this.handleTabSelect}
          />
        </div>
        {this.renderSections()}
      </div>
    );
  }

  private async generateMnemonicAndKeyPair() {
    if (this.state.generatedRecoveryPhrase === '') {
      const language = 'english';
      const mnemonic = await window
        .getAccountManager()
        .generateMnemonic(language);

      let seedHex = window.mnemonic.mn_decode(mnemonic, language);
      // handle shorter than 32 bytes seeds
      const privKeyHexLength = 32 * 2;
      if (seedHex.length !== privKeyHexLength) {
        seedHex = seedHex.concat('0'.repeat(32));
        seedHex = seedHex.substring(0, privKeyHexLength);
      }
      const seed = window.dcodeIO.ByteBuffer.wrap(
        seedHex,
        'hex'
      ).toArrayBuffer();
      const keyPair = await window.sessionGenerateKeyPair(seed);
      const hexGeneratedPubKey = StringUtils.decode(keyPair.pubKey, 'hex');

      this.setState({
        generatedRecoveryPhrase: mnemonic,
        hexGeneratedPubKey, // our 'frontend' sessionID
      });
    }
  }

  private readonly handleTabSelect = (tabType: TabType): void => {
    this.setState({
      selectedTab: tabType,
    });
  };

  private renderSections() {
    const {
      selectedTab,
      generatedRecoveryPhrase,
      hexGeneratedPubKey,
    } = this.state;
    if (selectedTab === TabType.SignUp) {
      return (
        <SignUpTab
          generatedRecoveryPhrase={generatedRecoveryPhrase}
          hexGeneratedPubKey={hexGeneratedPubKey}
        />
      );
    }

    return <SignInTab />;
  }

  private async register() {
    // const {
    //   password,
    //   recoveryPhrase,
    //   generatedRecoveryPhrase,
    //   signInMode,
    //   displayName,
    //   passwordErrorString,
    //   passwordFieldsMatch,
    // } = this.state;
    // if (signInMode === SignInMode.UsingRecoveryPhrase && !recoveryPhrase) {
    //   window.log.warn('empty mnemonic seed passed in seed restoration mode');
    //   return;
    // } else if (!generatedRecoveryPhrase) {
    //   window.log.warn('empty generated seed');
    //   return;
    // }
    // const seedToUse =
    //   signInMode === SignInMode.UsingRecoveryPhrase
    //     ? recoveryPhrase
    //     : generatedRecoveryPhrase;
    // try {
    //   await this.resetRegistration();
    //   await window.setPassword(password);
    //   const isRestoringFromSeed = signInMode === SignInMode.UsingRecoveryPhrase;
    //   UserUtils.setRestoringFromSeed(isRestoringFromSeed);
    //   await window
    //     .getAccountManager()
    //     .registerSingleDevice(seedToUse, 'english', trimName);
    //   // if we are just creating a new account, no need to wait for a configuration message
    //   if (!isRestoringFromSeed) {
    //     trigger('openInbox');
    //   } else {
    //     // We have to pull for all messages of the user of this menmonic
    //     // We are looking for the most recent ConfigurationMessage he sent to himself.
    //     // When we find it, we can just get the displayName, avatar and groups saved in it.
    //     // If we do not find one, we will need to ask for a display name.
    //     window.log.warn('isRestoringFromSeed');
    //   }
    // } catch (e) {
    //   ToastUtils.pushToastError(
    //     'registrationError',
    //     `Error: ${e.message || 'Something went wrong'}`
    //   );
    //   let exmsg = '';
    //   if (e.message) {
    //     exmsg += e.message;
    //   }
    //   if (e.stack) {
    //     exmsg += ` | stack:  + ${e.stack}`;
    //   }
    //   window.log.warn('exception during registration:', exmsg);
    // }
  }
}

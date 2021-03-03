import React from 'react';

import {
  PromiseUtils,
  StringUtils,
  ToastUtils,
  UserUtils,
} from '../../../session/utils';
import { ConversationController } from '../../../session/conversations';
import { createOrUpdateItem, removeAll } from '../../../data/data';
import { SignUpTab } from './SignUpTab';
import { SignInTab } from './SignInTab';
import { TabLabel, TabType } from './TabLabel';
import { PasswordUtil } from '../../../util';
import { trigger } from '../../../shims/events';
import {
  AccountManager,
  sessionGenerateKeyPair,
} from '../../../util/accountManager';
import { fromHex, fromHexToArray } from '../../../session/utils/String';
import { TaskTimedOutError } from '../../../session/utils/Promise';

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

const passwordsAreValid = (password: string, verifyPassword: string) => {
  const passwordErrors = validatePassword(password, verifyPassword);
  if (passwordErrors.passwordErrorString) {
    window.log.warn('invalid password for registration');
    ToastUtils.pushToastError(
      'invalidPassword',
      window.i18n('invalidPassword')
    );
    return false;
  }
  if (!!password && !passwordErrors.passwordFieldsMatch) {
    window.log.warn('passwords does not match for registration');
    ToastUtils.pushToastError(
      'invalidPassword',
      window.i18n('passwordsDoNotMatch')
    );
    return false;
  }

  return true;
};

/**
 * Returns undefined if an error happened, or the trim userName.
 *
 * Be sure to use the trimmed userName for creating the account.
 */
const displayNameIsValid = (displayName: string): undefined | string => {
  const trimName = displayName.trim();

  if (!trimName) {
    window.log.warn('invalid trimmed name for registration');
    ToastUtils.pushToastError(
      'invalidDisplayName',
      window.i18n('displayNameEmpty')
    );
    return undefined;
  }
  return trimName;
};

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
  window.log.info('SIGNING UP');

  const trimName = displayNameIsValid(displayName);
  // shows toast to user about the error
  if (!trimName) {
    return;
  }

  // This will show a toast with the error
  if (!passwordsAreValid(password, verifyPassword)) {
    return;
  }

  try {
    await resetRegistration();
    await window.setPassword(password);
    await AccountManager.registerSingleDevice(
      generatedRecoveryPhrase,
      'english',
      trimName
    );
    await createOrUpdateItem({
      id: 'hasSyncedInitialConfigurationItem',
      value: true,
    });
    trigger('openInbox');
  } catch (e) {
    await resetRegistration();

    ToastUtils.pushToastError(
      'registrationError',
      `Error: ${e.message || 'Something went wrong'}`
    );
    window.log.warn('exception during registration:', e);
  }
}

/**
 * Sign in/restore from seed.
 * Ask for a display name, as we will drop incoming ConfigurationMessages if any are saved on the swarm.
 * We will handle a ConfigurationMessage
 */
export async function signInWithRecovery(signInDetails: {
  displayName: string;
  userRecoveryPhrase: string;
  password: string;
  verifyPassword: string;
}) {
  const {
    displayName,
    password,
    verifyPassword,
    userRecoveryPhrase,
  } = signInDetails;
  window.log.info('RESTORING FROM SEED');
  const trimName = displayNameIsValid(displayName);
  // shows toast to user about the error
  if (!trimName) {
    return;
  }
  // This will show a toast with the error
  if (!passwordsAreValid(password, verifyPassword)) {
    return;
  }

  try {
    await resetRegistration();
    await window.setPassword(password);

    await AccountManager.registerSingleDevice(
      userRecoveryPhrase,
      'english',
      trimName
    );
    trigger('openInbox');
  } catch (e) {
    await resetRegistration();
    ToastUtils.pushToastError(
      'registrationError',
      `Error: ${e.message || 'Something went wrong'}`
    );
    window.log.warn('exception during registration:', e);
  }
}

export async function signInWithLinking(signInDetails: {
  userRecoveryPhrase: string;
  password: string;
  verifyPassword: string;
}) {
  const { password, verifyPassword, userRecoveryPhrase } = signInDetails;
  window.log.info('LINKING DEVICE');
  // This will show a toast with the error
  if (!passwordsAreValid(password, verifyPassword)) {
    return;
  }
  try {
    await resetRegistration();
    await window.setPassword(password);
    await AccountManager.signInByLinkingDevice(userRecoveryPhrase, 'english');

    let displayNameFromNetwork = '';

    await PromiseUtils.waitForTask(done => {
      window.Whisper.events.on(
        'configurationMessageReceived',
        (displayName: string) => {
          window.Whisper.events.off('configurationMessageReceived');
          UserUtils.setSignInByLinking(false);
          done(displayName);

          displayNameFromNetwork = displayName;
        }
      );
    }, 30000);
    if (displayNameFromNetwork.length) {
      // display name, avatars, groups and contacts should already be handled when this event was triggered.
      window.log.info('We got a displayName from network: ');
    } else {
      window.log.info(
        'Got a config message from network but without a displayName...'
      );
      throw new Error(
        'Got a config message from network but without a displayName...'
      );
    }
    // Do not set the lastProfileUpdateTimestamp.
    // We expect to get a display name from a configuration message while we are loading messages of this user
    trigger('openInbox');
  } catch (e) {
    await resetRegistration();
    if (e instanceof TaskTimedOutError) {
      ToastUtils.pushToastError(
        'registrationError',
        'Could not find your display name. Please Sign In by Restoring Your Account instead.'
      );
    } else {
      ToastUtils.pushToastError(
        'registrationError',
        `Error: ${e.message || 'Something went wrong'}`
      );
    }
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
      const mnemonic = await AccountManager.generateMnemonic(language);

      let seedHex = window.mnemonic.mn_decode(mnemonic, language);
      // handle shorter than 32 bytes seeds
      const privKeyHexLength = 32 * 2;
      if (seedHex.length !== privKeyHexLength) {
        seedHex = seedHex.concat('0'.repeat(32));
        seedHex = seedHex.substring(0, privKeyHexLength);
      }
      const seed = fromHex(seedHex);
      const keyPair = await sessionGenerateKeyPair(seed);
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
}

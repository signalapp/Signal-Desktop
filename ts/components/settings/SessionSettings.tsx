import React from 'react';

import { SettingsHeader } from './SessionSettingsHeader';
import { shell } from 'electron';
import { SessionIconButton } from '../icon';
import autoBind from 'auto-bind';
import { SessionNotificationGroupSettings } from './SessionNotificationGroupSettings';
// tslint:disable-next-line: no-submodule-imports
import { CategoryConversations } from './section/CategoryConversations';
import { SettingsCategoryPrivacy } from './section/CategoryPrivacy';
import { SettingsCategoryAppearance } from './section/CategoryAppearance';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { Data } from '../../data/data';
import { LocalizerKeys } from '../../types/LocalizerKeys';
import { matchesHash } from '../../util/passwordUtils';
import { SettingsCategoryPermissions } from './section/CategoryPermissions';
import { SettingsCategoryHelp } from './section/CategoryHelp';

export function getMediaPermissionsSettings() {
  return window.getSettingValue('media-permissions');
}

export function getCallMediaPermissionsSettings() {
  return window.getSettingValue('call-media-permissions');
}

export enum SessionSettingCategory {
  Privacy = 'privacy',
  Notifications = 'notifications',

  Conversations = 'conversations',
  MessageRequests = 'messageRequests',

  Appearance = 'appearance',
  Permissions = 'permissions',
  Help = 'help',
  RecoveryPhrase = 'recoveryPhrase',
  ClearData = 'ClearData',
}

export interface SettingsViewProps {
  category: SessionSettingCategory;
}

interface State {
  hasPassword: boolean | null;
  pwdLockError: string | null;
  mediaSetting: boolean | null;
  callMediaSetting: boolean | null;
  shouldLockSettings: boolean | null;
}

const SessionInfo = () => {
  const openOxenWebsite = () => {
    void shell.openExternal('https://oxen.io/');
  };
  return (
    <div className="session-settings__version-info">
      <span className="text-selectable">v{window.versionInfo.version}</span>
      <span>
        <SessionIconButton iconSize="medium" iconType="oxen" onClick={openOxenWebsite} />
      </span>
      <span className="text-selectable">{window.versionInfo.commitHash}</span>
    </div>
  );
};

export const PasswordLock = ({
  pwdLockError,
  validatePasswordLock,
}: {
  pwdLockError: string | null;
  validatePasswordLock: () => Promise<boolean>;
}) => {
  return (
    <div className="session-settings__password-lock">
      <div className="session-settings__password-lock-box">
        <h3>{window.i18n('password')}</h3>
        <input
          type="password"
          id="password-lock-input"
          defaultValue=""
          placeholder="Password"
          data-testid="password-lock-input"
        />

        {pwdLockError && <div className="session-label warning">{pwdLockError}</div>}

        <SessionButton
          buttonType={SessionButtonType.BrandOutline}
          buttonColor={SessionButtonColor.Green}
          text={window.i18n('ok')}
          onClick={validatePasswordLock}
        />
      </div>
    </div>
  );
};

export class SessionSettingsView extends React.Component<SettingsViewProps, State> {
  public settingsViewRef: React.RefObject<HTMLDivElement>;

  public constructor(props: any) {
    super(props);

    this.state = {
      hasPassword: null,
      pwdLockError: null,
      mediaSetting: null,
      callMediaSetting: null,
      shouldLockSettings: true,
    };

    this.settingsViewRef = React.createRef();
    autoBind(this);

    void this.hasPassword();
  }

  public componentDidMount() {
    window.addEventListener('keyup', this.onKeyUp);

    const mediaSetting = getMediaPermissionsSettings();
    const callMediaSetting = getCallMediaPermissionsSettings();
    this.setState({ mediaSetting, callMediaSetting });

    setTimeout(() => document.getElementById('password-lock-input')?.focus(), 100);
  }

  public componentWillUnmount() {
    window.removeEventListener('keyup', this.onKeyUp);
  }

  /* tslint:disable-next-line:max-func-body-length */
  public renderSettingInCategory() {
    const { category } = this.props;

    if (this.state.hasPassword === null) {
      return null;
    }
    const hasPassword = this.state.hasPassword;
    switch (category) {
      // special case for blocked user
      case SessionSettingCategory.Conversations:
        return <CategoryConversations />;
      case SessionSettingCategory.Appearance:
        return <SettingsCategoryAppearance hasPassword={hasPassword} />;
      case SessionSettingCategory.Notifications:
        return <SessionNotificationGroupSettings hasPassword={hasPassword} />;
      case SessionSettingCategory.Privacy:
        return (
          <SettingsCategoryPrivacy
            onPasswordUpdated={this.onPasswordUpdated}
            hasPassword={hasPassword}
          />
        );
      case SessionSettingCategory.Help:
        return <SettingsCategoryHelp hasPassword={hasPassword} />;
      case SessionSettingCategory.Permissions:
        return <SettingsCategoryPermissions hasPassword={hasPassword} />;

      // those three down there have no options, they are just a button
      case SessionSettingCategory.ClearData:
      case SessionSettingCategory.MessageRequests:
      case SessionSettingCategory.RecoveryPhrase:
      default:
        return null;
    }
  }

  public async validatePasswordLock() {
    const enteredPassword = String(
      (document.getElementById('password-lock-input') as HTMLInputElement)?.value
    );

    if (!enteredPassword) {
      this.setState({
        pwdLockError: window.i18n('noGivenPassword'),
      });

      return false;
    }

    // Check if the password matches the hash we have stored
    const hash = await Data.getPasswordHash();
    if (hash && !matchesHash(enteredPassword, hash)) {
      this.setState({
        pwdLockError: window.i18n('invalidPassword'),
      });

      return false;
    }

    // Unlocked settings
    this.setState({
      shouldLockSettings: false,
      pwdLockError: null,
    });

    return true;
  }

  public render() {
    const { category } = this.props;
    const shouldRenderPasswordLock = this.state.shouldLockSettings && this.state.hasPassword;
    const categoryLocalized: LocalizerKeys =
      category === SessionSettingCategory.Appearance
        ? 'appearanceSettingsTitle'
        : category === SessionSettingCategory.Conversations
        ? 'blockedSettingsTitle'
        : category === SessionSettingCategory.Notifications
        ? 'notificationsSettingsTitle'
        : 'privacySettingsTitle';

    return (
      <div className="session-settings">
        <SettingsHeader category={category} categoryTitle={window.i18n(categoryLocalized)} />

        <div className="session-settings-view">
          {shouldRenderPasswordLock ? (
            <PasswordLock
              pwdLockError={this.state.pwdLockError}
              validatePasswordLock={this.validatePasswordLock}
            />
          ) : (
            <div ref={this.settingsViewRef} className="session-settings-list">
              {this.renderSettingInCategory()}
            </div>
          )}
          <SessionInfo />
        </div>
      </div>
    );
  }

  public async hasPassword() {
    const hash = await Data.getPasswordHash();

    this.setState({
      hasPassword: !!hash,
    });
  }

  public onPasswordUpdated(action: string) {
    if (action === 'set' || action === 'change') {
      this.setState({
        hasPassword: true,
        shouldLockSettings: true,
        pwdLockError: null,
      });
    }

    if (action === 'remove') {
      this.setState({
        hasPassword: false,
      });
    }
  }

  private async onKeyUp(event: any) {
    const lockPasswordVisible = Boolean(document.getElementById('password-lock-input'));

    if (event.key === 'Enter' && lockPasswordVisible) {
      await this.validatePasswordLock();
    }

    event.preventDefault();
  }
}

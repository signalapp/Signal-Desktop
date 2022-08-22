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
import { matchesHash } from '../../util/passwordUtils';
import { SettingsCategoryPermissions } from './section/CategoryPermissions';
import { SettingsCategoryHelp } from './section/CategoryHelp';
import styled from 'styled-components';

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

const StyledVersionInfo = styled.div`
  display: flex;
  justify-content: space-between;

  padding: var(--margins-sm) var(--margins-md);
  background: none;
  font-size: var(--font-size-xs);
`;

const StyledSpanSessionInfo = styled.span`
  opacity: 0.4;
  transition: var(--default-duration);
  user-select: text;

  :hover {
    opacity: 1;
  }
`;

const SessionInfo = () => {
  const openOxenWebsite = () => {
    void shell.openExternal('https://oxen.io/');
  };
  return (
    <StyledVersionInfo>
      <StyledSpanSessionInfo>v{window.versionInfo.version}</StyledSpanSessionInfo>
      <StyledSpanSessionInfo>
        <SessionIconButton iconSize="medium" iconType="oxen" onClick={openOxenWebsite} />
      </StyledSpanSessionInfo>
      <StyledSpanSessionInfo>{window.versionInfo.commitHash}</StyledSpanSessionInfo>
    </StyledVersionInfo>
  );
};

const StyledPasswordInput = styled.input`
  width: 100%;
  background: var(--color-input-background);
  color: var(--color-text);

  padding: var(--margins-xs) var(--margins-md);
  margin-bottom: var(--margins-lg);
  outline: none;
  border: none;
  border-radius: 2px;
  text-align: center;
  font-size: 24px;
  letter-spacing: 5px;
  font-family: var(--font-default);
`;

const StyledH3 = styled.h3`
  padding: 0px;
  margin-bottom: var(--margins-lg);
`;

const PasswordLock = ({
  pwdLockError,
  validatePasswordLock,
}: {
  pwdLockError: string | null;
  validatePasswordLock: () => Promise<boolean>;
}) => {
  return (
    <div className="session-settings__password-lock">
      <div className="session-settings__password-lock-box">
        <StyledH3>{window.i18n('password')}</StyledH3>
        <StyledPasswordInput
          type="password"
          id="password-lock-input"
          defaultValue=""
          placeholder="Password"
          data-testid="password-lock-input"
          autoFocus={true}
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

const SettingInCategory = (props: {
  category: SessionSettingCategory;
  hasPassword: boolean;
  onPasswordUpdated: (action: string) => void;
}) => {
  const { category, hasPassword, onPasswordUpdated } = props;

  if (hasPassword === null) {
    return null;
  }
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
        <SettingsCategoryPrivacy onPasswordUpdated={onPasswordUpdated} hasPassword={hasPassword} />
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

    void Data.getPasswordHash().then(hash => {
      this.setState({
        hasPassword: !!hash,
      });
    });
  }

  public componentDidMount() {
    window.addEventListener('keyup', this.onKeyUp);

    const mediaSetting = getMediaPermissionsSettings();
    const callMediaSetting = getCallMediaPermissionsSettings();
    this.setState({ mediaSetting, callMediaSetting });
  }

  public componentWillUnmount() {
    window.removeEventListener('keyup', this.onKeyUp);
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

    return (
      <div className="session-settings">
        <SettingsHeader category={category} />

        <div className="session-settings-view">
          {shouldRenderPasswordLock ? (
            <PasswordLock
              pwdLockError={this.state.pwdLockError}
              validatePasswordLock={this.validatePasswordLock}
            />
          ) : (
            <div ref={this.settingsViewRef} className="session-settings-list">
              <SettingInCategory
                category={category}
                onPasswordUpdated={this.onPasswordUpdated}
                hasPassword={Boolean(this.state.hasPassword)}
              />
            </div>
          )}
          <SessionInfo />
        </div>
      </div>
    );
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

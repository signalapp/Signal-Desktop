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
import { Data } from '../../data/data';
import { SettingsCategoryPermissions } from './section/CategoryPermissions';
import { SettingsCategoryHelp } from './section/CategoryHelp';
import styled from 'styled-components';
import { sessionPassword } from '../../state/ducks/modalDialog';
import { PasswordAction } from '../dialog/SessionPasswordDialog';

export function displayPasswordModal(
  passwordAction: PasswordAction,
  onPasswordUpdated: (action: string) => void
) {
  window.inboxStore?.dispatch(
    sessionPassword({
      passwordAction,
      onOk: () => {
        onPasswordUpdated(passwordAction);
      },
    })
  );
}

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
  cursor: pointer;

  &:hover {
    opacity: 1;
  }
`;

const SessionInfo = () => {
  return (
    <StyledVersionInfo>
      <StyledSpanSessionInfo
        onClick={() => {
          void shell.openExternal(
            `https://github.com/oxen-io/session-desktop/releases/tag/v${window.versionInfo.version}`
          );
        }}
      >
        v{window.versionInfo.version}
      </StyledSpanSessionInfo>
      <StyledSpanSessionInfo>
        <SessionIconButton
          iconSize="medium"
          iconType="oxen"
          onClick={() => {
            void shell.openExternal('https://oxen.io/');
          }}
        />
      </StyledSpanSessionInfo>
      <StyledSpanSessionInfo>{window.versionInfo.commitHash}</StyledSpanSessionInfo>
    </StyledVersionInfo>
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

    // these three down there have no options, they are just a button
    case SessionSettingCategory.ClearData:
    case SessionSettingCategory.MessageRequests:
    case SessionSettingCategory.RecoveryPhrase:
    default:
      return null;
  }
};

const StyledSettingsView = styled.div`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
`;

const StyledSettingsList = styled.div`
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
`;

export class SessionSettingsView extends React.Component<SettingsViewProps, State> {
  public settingsViewRef: React.RefObject<HTMLDivElement>;

  public constructor(props: any) {
    super(props);

    this.state = {
      hasPassword: null,
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

  public componentDidUpdate(_: SettingsViewProps, _prevState: State) {
    const oldShouldRenderPasswordLock = _prevState.shouldLockSettings && _prevState.hasPassword;
    const newShouldRenderPasswordLock = this.state.shouldLockSettings && this.state.hasPassword;

    if (
      newShouldRenderPasswordLock &&
      newShouldRenderPasswordLock !== oldShouldRenderPasswordLock
    ) {
      displayPasswordModal('enter', action => {
        if (action === 'enter') {
          // Unlocked settings
          this.setState({
            shouldLockSettings: false,
          });
        }
      });
    }
  }

  public render() {
    const { category } = this.props;
    const shouldRenderPasswordLock = this.state.shouldLockSettings && this.state.hasPassword;

    return (
      <div className="session-settings">
        {shouldRenderPasswordLock ? (
          <></>
        ) : (
          <>
            <SettingsHeader category={category} />
            <StyledSettingsView>
              <StyledSettingsList ref={this.settingsViewRef}>
                <SettingInCategory
                  category={category}
                  onPasswordUpdated={this.onPasswordUpdated}
                  hasPassword={Boolean(this.state.hasPassword)}
                />
              </StyledSettingsList>
              <SessionInfo />
            </StyledSettingsView>
          </>
        )}
      </div>
    );
  }

  public onPasswordUpdated(action: string) {
    if (action === 'set' || action === 'change') {
      this.setState({
        hasPassword: true,
        shouldLockSettings: true,
      });
    }

    if (action === 'remove') {
      this.setState({
        hasPassword: false,
      });
    }
  }
}

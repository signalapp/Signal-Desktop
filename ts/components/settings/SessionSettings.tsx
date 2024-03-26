import autoBind from 'auto-bind';
import { shell } from 'electron';
import React from 'react';
import styled from 'styled-components';

import { SettingsHeader } from './SessionSettingsHeader';

import { SessionIconButton } from '../icon';

import { SessionNotificationGroupSettings } from './SessionNotificationGroupSettings';

import { Data } from '../../data/data';
import { sessionPassword } from '../../state/ducks/modalDialog';
import { SectionType, showLeftPaneSection } from '../../state/ducks/section';
import { PasswordAction } from '../dialog/SessionPasswordDialog';
import { SettingsCategoryAppearance } from './section/CategoryAppearance';
import { CategoryConversations } from './section/CategoryConversations';
import { SettingsCategoryHelp } from './section/CategoryHelp';
import { SettingsCategoryPermissions } from './section/CategoryPermissions';
import { SettingsCategoryPrivacy } from './section/CategoryPrivacy';

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
  onPasswordUpdated: (action: string) => void;
  hasPassword: boolean;
}) => {
  const { category, onPasswordUpdated, hasPassword } = props;

  switch (category) {
    // special case for blocked user
    case SessionSettingCategory.Conversations:
      return <CategoryConversations />;
    case SessionSettingCategory.Appearance:
      return <SettingsCategoryAppearance />;
    case SessionSettingCategory.Notifications:
      return <SessionNotificationGroupSettings />;
    case SessionSettingCategory.Privacy:
      return (
        <SettingsCategoryPrivacy onPasswordUpdated={onPasswordUpdated} hasPassword={hasPassword} />
      );
    case SessionSettingCategory.Help:
      return <SettingsCategoryHelp />;
    case SessionSettingCategory.Permissions:
      return <SettingsCategoryPermissions />;

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

export class SessionSettingsView extends React.Component<
  SettingsViewProps,
  { hasPassword: boolean }
> {
  public settingsViewRef: React.RefObject<HTMLDivElement>;

  public constructor(props: any) {
    super(props);

    this.settingsViewRef = React.createRef();
    autoBind(this);
    this.state = { hasPassword: true };

    // eslint-disable-next-line more/no-then
    void Data.getPasswordHash().then(hash => {
      this.setState({
        hasPassword: !!hash,
      });
    });
  }

  public render() {
    const { category } = this.props;

    return (
      <div className="session-settings">
        <SettingsHeader category={category} />
        <StyledSettingsView>
          <StyledSettingsList ref={this.settingsViewRef}>
            <SettingInCategory
              category={category}
              onPasswordUpdated={this.onPasswordUpdated}
              hasPassword={this.state.hasPassword}
            />
          </StyledSettingsList>
          <SessionInfo />
        </StyledSettingsView>
      </div>
    );
  }

  public onPasswordUpdated(action: string) {
    if (action === 'set' || action === 'change') {
      this.setState({
        hasPassword: true,
      });
      window.inboxStore?.dispatch(showLeftPaneSection(SectionType.Message));
    }

    if (action === 'remove') {
      this.setState({
        hasPassword: false,
      });
    }
  }
}

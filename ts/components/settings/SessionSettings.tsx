import { shell } from 'electron';
import React, { useState } from 'react';
import styled from 'styled-components';

import { useDispatch } from 'react-redux';
import useMount from 'react-use/lib/useMount';
import { SettingsHeader } from './SessionSettingsHeader';

import { SessionIconButton } from '../icon';

import { SessionNotificationGroupSettings } from './SessionNotificationGroupSettings';

import { Data } from '../../data/data';
import { sessionPassword } from '../../state/ducks/modalDialog';
import { SectionType, showLeftPaneSection } from '../../state/ducks/section';
import { SettingsCategoryAppearance } from './section/CategoryAppearance';
import { CategoryConversations } from './section/CategoryConversations';
import { SettingsCategoryHelp } from './section/CategoryHelp';
import { SettingsCategoryPermissions } from './section/CategoryPermissions';
import { SettingsCategoryPrivacy } from './section/CategoryPrivacy';
import type { SessionSettingCategory, PasswordAction } from '../../types/ReduxTypes';

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
    case 'conversations':
      return <CategoryConversations />;
    case 'appearance':
      return <SettingsCategoryAppearance />;
    case 'notifications':
      return <SessionNotificationGroupSettings />;
    case 'privacy':
      return (
        <SettingsCategoryPrivacy onPasswordUpdated={onPasswordUpdated} hasPassword={hasPassword} />
      );
    case 'help':
      return <SettingsCategoryHelp />;
    case 'permissions':
      return <SettingsCategoryPermissions />;

    // these three down there have no options, they are just a button
    case 'clearData':
    case 'messageRequests':
    case 'recoveryPhrase':
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

export const SessionSettingsView = (props: SettingsViewProps) => {
  const { category } = props;
  const dispatch = useDispatch();

  const [hasPassword, setHasPassword] = useState(true);
  useMount(() => {
    let isMounted = true;
    // eslint-disable-next-line more/no-then
    void Data.getPasswordHash().then(hash => {
      if (isMounted) {
        setHasPassword(!!hash);
      }
    });
    return () => {
      isMounted = false;
    };
  });

  function onPasswordUpdated(action: string) {
    if (action === 'set' || action === 'change') {
      setHasPassword(true);
      dispatch(showLeftPaneSection(SectionType.Message));
    }

    if (action === 'remove') {
      setHasPassword(false);
    }
  }

  return (
    <div className="session-settings">
      <SettingsHeader category={category} />
      <StyledSettingsView>
        <StyledSettingsList>
          <SettingInCategory
            category={category}
            onPasswordUpdated={onPasswordUpdated}
            hasPassword={hasPassword}
          />
        </StyledSettingsList>
        <SessionInfo />
      </StyledSettingsView>
    </div>
  );
};

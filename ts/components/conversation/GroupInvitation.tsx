import React from 'react';
import classNames from 'classnames';
import { SessionIconButton, SessionIconSize, SessionIconType } from '../session/icon';
import { useTheme } from 'styled-components';
import { PropsForGroupInvitation } from '../../state/ducks/conversations';
import { acceptOpenGroupInvitation } from '../../interactions/messageInteractions';

export const GroupInvitation = (props: PropsForGroupInvitation) => {
  const theme = useTheme();
  const classes = ['group-invitation'];

  if (props.direction === 'outgoing') {
    classes.push('invitation-outgoing');
  }
  const openGroupInvitation = window.i18n('openGroupInvitation');

  return (
    <div className="group-invitation-container" id={props.messageId}>
      <div className={classNames(classes)}>
        <div className="contents">
          <SessionIconButton
            iconType={SessionIconType.Plus}
            iconColor={theme.colors.accent}
            theme={theme}
            iconSize={SessionIconSize.Large}
            onClick={() => {
              acceptOpenGroupInvitation(props.acceptUrl, props.serverName);
            }}
          />
          <span className="group-details">
            <span className="group-name">{props.serverName}</span>
            <span className="group-type">{openGroupInvitation}</span>
            <span className="group-address">{props.url}</span>
          </span>
        </div>
      </div>
    </div>
  );
};

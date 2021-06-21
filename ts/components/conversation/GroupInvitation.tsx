import React from 'react';
import classNames from 'classnames';
import { SessionIconButton, SessionIconSize, SessionIconType } from '../session/icon';
import { useTheme } from 'styled-components';

type Props = {
  name: string;
  url: string;
  direction: string;
  onJoinClick: () => void;
};

export const GroupInvitation = (props: Props) => {
  const theme = useTheme();
  const classes = ['group-invitation'];

  if (props.direction === 'outgoing') {
    classes.push('invitation-outgoing');
  }
  const openGroupInvitation = window.i18n('openGroupInvitation');

  return (
    <div className="group-invitation-container">
      <div className={classNames(classes)}>
        <div className="contents">
          <SessionIconButton
            iconType={SessionIconType.Plus}
            iconColor={theme.colors.accent}
            theme={theme}
            iconSize={SessionIconSize.Large}
            onClick={props.onJoinClick}
          />
          <span className="group-details">
            <span className="group-name">{props.name}</span>
            <span className="group-type">{openGroupInvitation}</span>
            <span className="group-address">{props.url}</span>
          </span>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import classNames from 'classnames';
import { PropsForGroupInvitation } from '../../../../state/ducks/conversations';
import { acceptOpenGroupInvitation } from '../../../../interactions/messageInteractions';
import { SessionIconButton } from '../../../icon';
import styled from 'styled-components';
import { ExpirableReadableMessage } from './ExpirableReadableMessage';

const StyledIconContainer = styled.div`
  background-color: var(--message-link-preview-background-color);
  border-radius: 100%;
`;

export const GroupInvitation = (props: PropsForGroupInvitation) => {
  const { messageId } = props;
  const classes = ['group-invitation'];

  if (props.direction === 'outgoing') {
    classes.push('invitation-outgoing');
  }
  const openGroupInvitation = window.i18n('openGroupInvitation');

  return (
    <ExpirableReadableMessage messageId={messageId} key={`readable-message-${messageId}`}>
      <div className="group-invitation-container" id={`msg-${props.messageId}`}>
        <div className={classNames(classes)}>
          <div className="contents">
            <StyledIconContainer>
              <SessionIconButton
                iconColor={
                  props.direction === 'outgoing'
                    ? 'var(--message-bubbles-sent-text-color)'
                    : 'var(--message-bubbles-received-text-color)'
                }
                iconType={props.direction === 'outgoing' ? 'communities' : 'plus'}
                iconSize={'large'}
                onClick={() => {
                  acceptOpenGroupInvitation(props.acceptUrl, props.serverName);
                }}
              />
            </StyledIconContainer>
            <span className="group-details">
              <span className="group-name">{props.serverName}</span>
              <span className="group-type">{openGroupInvitation}</span>
              <span className="group-address">{props.url}</span>
            </span>
          </div>
        </div>
      </div>
    </ExpirableReadableMessage>
  );
};

import classNames from 'classnames';
import React from 'react';
import styled from 'styled-components';

import { acceptOpenGroupInvitation } from '../../../../interactions/messageInteractions';
import { PropsForGroupInvitation } from '../../../../state/ducks/conversations';
import { SessionIconButton } from '../../../icon';
import { ExpirableReadableMessage } from './ExpirableReadableMessage';

const StyledGroupInvitation = styled.div`
  background-color: var(--message-bubbles-received-background-color);

  &.invitation-outgoing {
    background-color: var(--message-bubbles-sent-background-color);
    align-self: flex-end;

    .contents {
      .group-details {
        color: var(--message-bubbles-sent-text-color);
      }
      .session-icon-button {
        background-color: var(--transparent-color);
      }
    }
  }

  display: inline-block;
  padding: 4px;
  margin: var(--margins-xs) calc(var(--margins-lg) + var(--margins-md)) 0 var(--margins-lg);

  border-radius: var(--border-radius-message-box);

  align-self: flex-start;

  box-shadow: none;

  .contents {
    display: flex;
    align-items: center;
    margin: 6px;

    .invite-group-avatar {
      height: 48px;
      width: 48px;
    }

    .group-details {
      display: inline-flex;
      flex-direction: column;
      color: var(--message-bubbles-received-text-color);

      padding: 0px 12px;
      .group-name {
        font-weight: bold;
        font-size: 18px;
      }
    }

    .session-icon-button {
      background-color: var(--primary-color);
    }
  }
`;

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
    <ExpirableReadableMessage
      messageId={messageId}
      key={`readable-message-${messageId}`}
      dataTestId="control-message"
    >
      <StyledGroupInvitation className={classNames(classes)}>
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
      </StyledGroupInvitation>
    </ExpirableReadableMessage>
  );
};

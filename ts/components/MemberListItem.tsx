import React from 'react';
import classNames from 'classnames';
import { Avatar, AvatarSize, CrownIcon } from './avatar/Avatar';
import { Constants } from '../session';
import { SessionIcon } from './icon';
import { useConversationUsernameOrShorten } from '../hooks/useParamSelector';
import styled from 'styled-components';

const AvatarContainer = styled.div`
  position: relative;
`;

const AvatarItem = (props: { memberPubkey: string; isAdmin: boolean }) => {
  const { memberPubkey, isAdmin } = props;
  return (
    <AvatarContainer>
      <Avatar size={AvatarSize.XS} pubkey={memberPubkey} />
      {isAdmin && <CrownIcon />}
    </AvatarContainer>
  );
};

export const MemberListItem = (props: {
  pubkey: string;
  isSelected: boolean;
  // this bool is used to make a zombie appear with less opacity than a normal member
  isZombie?: boolean;
  disableBg?: boolean;
  isAdmin?: boolean; // if true,  we add a small crown on top of their avatar
  onSelect?: (pubkey: string) => void;
  onUnselect?: (pubkey: string) => void;
  dataTestId?: string;
}) => {
  const {
    isSelected,
    pubkey,
    isZombie,
    isAdmin,
    onSelect,
    onUnselect,
    disableBg,
    dataTestId,
  } = props;

  const memberName = useConversationUsernameOrShorten(pubkey);

  return (
    // tslint:disable-next-line: use-simple-attributes
    <div
      className={classNames(
        'session-member-item',
        isSelected && 'selected',
        isZombie && 'zombie',
        disableBg && 'compact'
      )}
      onClick={() => {
        isSelected ? onUnselect?.(pubkey) : onSelect?.(pubkey);
      }}
      style={
        !disableBg
          ? {
              backgroundColor: 'var(--color-cell-background)',
            }
          : {}
      }
      role="button"
      data-testid={dataTestId}
    >
      <div className="session-member-item__info">
        <span className="session-member-item__avatar">
          <AvatarItem memberPubkey={pubkey} isAdmin={isAdmin || false} />
        </span>
        <span className="session-member-item__name">{memberName}</span>
      </div>
      <span className={classNames('session-member-item__checkmark', isSelected && 'selected')}>
        <SessionIcon iconType="check" iconSize="medium" iconColor={Constants.UI.COLORS.GREEN} />
      </span>
    </div>
  );
};

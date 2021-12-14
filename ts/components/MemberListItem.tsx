import React from 'react';
import classNames from 'classnames';
import { Avatar, AvatarSize } from './avatar/Avatar';
import { Constants } from '../session';
import { SessionIcon } from './icon';
import { useConversationUsernameOrShorten } from '../hooks/useParamSelector';

const AvatarItem = (props: { memberPubkey: string }) => {
  return <Avatar size={AvatarSize.XS} pubkey={props.memberPubkey} />;
};

export const MemberListItem = (props: {
  pubkey: string;
  isSelected: boolean;
  // this bool is used to make a zombie appear with less opacity than a normal member
  isZombie?: boolean;
  onSelect?: (pubkey: string) => void;
  onUnselect?: (pubkey: string) => void;
}) => {
  const { isSelected, pubkey, isZombie, onSelect, onUnselect } = props;

  const memberName = useConversationUsernameOrShorten(pubkey);

  return (
    <div
      className={classNames('session-member-item', isSelected && 'selected', isZombie && 'zombie')}
      onClick={() => {
        isSelected ? onUnselect?.(pubkey) : onSelect?.(pubkey);
      }}
      role="button"
    >
      <div className="session-member-item__info">
        <span className="session-member-item__avatar">
          <AvatarItem memberPubkey={pubkey} />
        </span>
        <span className="session-member-item__name">{memberName}</span>
      </div>
      <span className={classNames('session-member-item__checkmark', isSelected && 'selected')}>
        <SessionIcon iconType="check" iconSize="medium" iconColor={Constants.UI.COLORS.GREEN} />
      </span>
    </div>
  );
};

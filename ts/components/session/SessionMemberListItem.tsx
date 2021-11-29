import React from 'react';
import classNames from 'classnames';

import { Avatar, AvatarSize } from '../Avatar';
import { SessionIcon } from './icon';
import { Constants } from '../../session';
import { PubKey } from '../../session/types';

export interface ContactType {
  id: string;
  selected: boolean;
  authorProfileName: string;
  authorPhoneNumber: string;
  authorName: string;
  authorAvatarPath: string;
  checkmarked: boolean;
  existingMember: boolean;
}

type Props = {
  member: ContactType;
  index: number; // index in the list
  isSelected: boolean;
  // this bool is used to make a zombie appear with less opacity than a normal member
  isZombie?: boolean;
  onSelect?: (selectedMember: ContactType) => void;
  onUnselect?: (selectedMember: ContactType) => void;
};

const AvatarItem = (props: { memberPubkey: string }) => {
  return <Avatar size={AvatarSize.XS} pubkey={props.memberPubkey} />;
};

export const SessionMemberListItem = (props: Props) => {
  const { isSelected, member, isZombie, onSelect, onUnselect } = props;

  const name = member.authorProfileName || PubKey.shorten(member.authorPhoneNumber);

  return (
    <div
      className={classNames(
        `session-member-item-${props.index}`,
        'session-member-item',
        isSelected && 'selected',
        isZombie && 'zombie'
      )}
      onClick={() => {
        isSelected ? onUnselect?.(member) : onSelect?.(member);
      }}
      role="button"
    >
      <div className="session-member-item__info">
        <span className="session-member-item__avatar">
          <AvatarItem memberPubkey={member.id} />
        </span>
        <span className="session-member-item__name">{name}</span>
      </div>
      <span className={classNames('session-member-item__checkmark', isSelected && 'selected')}>
        <SessionIcon iconType="check" iconSize="medium" iconColor={Constants.UI.COLORS.GREEN} />
      </span>
    </div>
  );
};

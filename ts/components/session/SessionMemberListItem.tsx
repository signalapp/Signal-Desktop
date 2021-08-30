import React from 'react';
import classNames from 'classnames';

import { Avatar, AvatarSize } from '../Avatar';
import { SessionIcon, SessionIconType } from './icon';
import { Constants } from '../../session';
import { useTheme } from 'styled-components';
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
  onSelect?: any;
  onUnselect?: any;
};

export const SessionMemberListItem = (props: Props) => {
  const { isSelected, member, isZombie, onSelect, onUnselect } = props;

  const renderAvatar = () => {
    const { authorAvatarPath, authorName, authorPhoneNumber, authorProfileName } = member;
    const userName = authorName || authorProfileName || authorPhoneNumber;
    return (
      <Avatar
        avatarPath={authorAvatarPath}
        name={userName}
        size={AvatarSize.XS}
        pubkey={authorPhoneNumber}
      />
    );
  };

  const selectMember = () => {
    onSelect?.(member);
  };
  const unselectMember = () => {
    onUnselect?.(member);
  };

  const handleSelectionAction = () => {
    isSelected ? unselectMember() : selectMember();
  };

  const theme = useTheme();
  const name = member.authorProfileName || PubKey.shorten(member.authorPhoneNumber);

  return (
    <div
      className={classNames(
        `session-member-item-${props.index}`,
        'session-member-item',
        isSelected && 'selected',
        isZombie && 'zombie'
      )}
      onClick={handleSelectionAction}
      role="button"
    >
      <div className="session-member-item__info">
        <span className="session-member-item__avatar">{renderAvatar()}</span>
        <span className="session-member-item__name">{name}</span>
      </div>
      <span className={classNames('session-member-item__checkmark', isSelected && 'selected')}>
        <SessionIcon
          iconType={SessionIconType.Check}
          iconSize={'medium'}
          iconColor={Constants.UI.COLORS.GREEN}
          theme={theme}
        />
      </span>
    </div>
  );
};

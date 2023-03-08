import React from 'react';
import { useMembersAvatars } from '../../../hooks/useMembersAvatars';
import { assertUnreachable } from '../../../types/sqlSharedTypes';
import { Avatar, AvatarSize } from '../Avatar';

type Props = {
  size: number;
  closedGroupId: string;
  onAvatarClick?: () => void;
};

function getClosedGroupAvatarsSize(size: AvatarSize): AvatarSize {
  // Always use the size directly under the one requested
  switch (size) {
    case AvatarSize.XS:
      throw new Error('AvatarSize.XS is not supported for closed group avatar sizes');
    case AvatarSize.S:
      return AvatarSize.XS;
    case AvatarSize.M:
      return AvatarSize.S;
    case AvatarSize.L:
      return AvatarSize.M;
    case AvatarSize.XL:
      return AvatarSize.L;
    case AvatarSize.HUGE:
      return AvatarSize.XL;
    default:
      assertUnreachable(size, `Invalid size request for closed group avatar "${size}"`);
  }
}

export const ClosedGroupAvatar = (props: Props) => {
  const { closedGroupId, size, onAvatarClick } = props;

  const memberAvatars = useMembersAvatars(closedGroupId);
  const avatarsDiameter = getClosedGroupAvatarsSize(size);
  const firstMemberId = memberAvatars?.[0];
  const secondMemberID = memberAvatars?.[1];

  return (
    <div className="module-avatar__icon-closed">
      <Avatar size={avatarsDiameter} pubkey={firstMemberId || ''} onAvatarClick={onAvatarClick} />
      <Avatar size={avatarsDiameter} pubkey={secondMemberID || ''} onAvatarClick={onAvatarClick} />
    </div>
  );
};

import { isEmpty } from 'lodash';

import { useIsClosedGroup, useSortedGroupMembers } from '../../../hooks/useParamSelector';
import { UserUtils } from '../../../session/utils';
import { assertUnreachable } from '../../../types/sqlSharedTypes';
import { Avatar, AvatarSize } from '../Avatar';

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
      return AvatarSize.XL; // just to make eslint happy
  }
}

/**
 * Move our pubkey at the end of the list if we are in the list of members.
 * We do this, as we want to
 * - show 2 other members when there are enough of them,
 * - show us as the 2nd member when there are only 2 members
 * - show us first with a grey avatar as second when there are only us in the group.
 */
function moveUsAtTheEnd(members: Array<string>, us: string) {
  const usAt = members.findIndex(val => val === us);
  if (us && usAt > -1) {
    // we need to move us at the end of the array
    const updated = members.filter(m => m !== us);
    updated.push(us);
    return updated;
  }
  return members;
}

function sortAndSlice(sortedMembers: Array<string>, us: string) {
  const usAtTheEndIfNeeded = moveUsAtTheEnd(sortedMembers, us); // make sure we are not one of the first 2 members if there is enough members
  // we render at most 2 avatars for closed groups
  return { firstMember: usAtTheEndIfNeeded?.[0], secondMember: usAtTheEndIfNeeded?.[1] };
}

function useGroupMembersAvatars(convoId: string | undefined) {
  const us = UserUtils.getOurPubKeyStrFromCache();
  const isClosedGroup = useIsClosedGroup(convoId);
  const sortedMembers = useSortedGroupMembers(convoId);

  if (!convoId || !isClosedGroup || isEmpty(sortedMembers)) {
    return undefined;
  }

  return sortAndSlice(sortedMembers, us);
}

export const ClosedGroupAvatar = ({
  convoId,
  size,
  onAvatarClick,
}: {
  size: number;
  convoId: string;
  onAvatarClick?: () => void;
}) => {
  const memberAvatars = useGroupMembersAvatars(convoId);
  const avatarsDiameter = getClosedGroupAvatarsSize(size);
  const firstMemberId = memberAvatars?.firstMember || '';
  const secondMemberID = memberAvatars?.secondMember || '';

  return (
    <div className="module-avatar__icon-closed">
      <Avatar size={avatarsDiameter} pubkey={firstMemberId} onAvatarClick={onAvatarClick} />
      <Avatar size={avatarsDiameter} pubkey={secondMemberID} onAvatarClick={onAvatarClick} />
    </div>
  );
};

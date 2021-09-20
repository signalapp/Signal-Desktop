import _ from 'lodash';
import { useEffect, useState } from 'react';
import { getConversationController } from '../session/conversations';
import { UserUtils } from '../session/utils';
import { ReduxConversationType } from '../state/ducks/conversations';

export function useMembersAvatars(conversation: ReduxConversationType | undefined) {
  const [membersAvatars, setMembersAvatars] = useState<
    | Array<{
        avatarPath: string | undefined;
        id: string;
        name: string;
      }>
    | undefined
  >(undefined);

  useEffect(
    () => {
      if (!conversation) {
        setMembersAvatars(undefined);
        return;
      }
      const { isPublic, isGroup, members: convoMembers } = conversation;
      if (!isPublic && isGroup) {
        const ourPrimary = UserUtils.getOurPubKeyStrFromCache();

        const ourself = convoMembers?.find(m => m !== ourPrimary) || undefined;
        // add ourself back at the back, so it's shown only if only 1 member and we are still a member
        let membersFiltered = convoMembers?.filter(m => m !== ourPrimary) || [];
        membersFiltered.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        if (ourself) {
          membersFiltered.push(ourPrimary);
        }
        // no need to forward more than 2 conversations for rendering the group avatar
        membersFiltered = membersFiltered.slice(0, 2);
        const memberConvos = _.compact(
          membersFiltered.map(m => getConversationController().get(m))
        );
        const memberAvatars = memberConvos.map(m => {
          return {
            avatarPath: m.getAvatarPath() || undefined,
            id: m.id as string,
            name: (m.get('name') || m.get('profileName') || m.id) as string,
          };
        });
        setMembersAvatars(memberAvatars);
      } else {
        setMembersAvatars(undefined);
      }
    },
    conversation ? [conversation.members, conversation.id] : []
  );

  return membersAvatars;
}

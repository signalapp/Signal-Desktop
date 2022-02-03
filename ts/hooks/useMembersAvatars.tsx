import { UserUtils } from '../session/utils';
import * as _ from 'lodash';
import { useSelector } from 'react-redux';
import { StateType } from '../state/reducer';

export function useMembersAvatars(closedGroupPubkey: string | undefined) {
  const ourPrimary = UserUtils.getOurPubKeyStrFromCache();

  return useSelector((state: StateType): Array<string> | undefined => {
    if (!closedGroupPubkey) {
      return undefined;
    }
    const groupConvo = state.conversations.conversationLookup[closedGroupPubkey];

    if (groupConvo.isPrivate || groupConvo.isPublic || !groupConvo.isGroup) {
      return undefined;
    }
    // this must be a closed group
    const originalMembers = _.cloneDeep(groupConvo.members);
    if (!originalMembers || originalMembers.length === 0) {
      return undefined;
    }
    const allMembersSorted = originalMembers.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

    // no need to forward more than 2 conversations for rendering the group avatar
    const usAtTheEndMaxTwo = _.sortBy(allMembersSorted, a => (a === ourPrimary ? 1 : 0)).slice(
      0,
      2
    );
    const memberConvos = _.compact(
      usAtTheEndMaxTwo
        .map(m => state.conversations.conversationLookup[m])
        .map(m => {
          return m?.id || undefined;
        })
    );

    return memberConvos && memberConvos.length ? memberConvos : undefined;
  });
}

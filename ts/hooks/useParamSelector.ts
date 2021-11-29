import { useSelector } from 'react-redux';
import { UserUtils } from '../session/utils';
import { StateType } from '../state/reducer';

export function useAvatarPath(pubkey: string | undefined) {
  return useSelector((state: StateType) => {
    if (!pubkey) {
      return null;
    }
    return state.conversations.conversationLookup[pubkey]?.avatarPath || null;
  });
}

export function useOurAvatarPath() {
  return useAvatarPath(UserUtils.getOurPubKeyStrFromCache());
}

/**
 *
 * @returns convo.profileName || convo.name || convo.id or undefined if the convo is not found
 */
export function useConversationUsername(pubkey?: string) {
  return useSelector((state: StateType) => {
    if (!pubkey) {
      return undefined;
    }
    const convo = state.conversations.conversationLookup[pubkey];
    if (!convo) {
      return pubkey;
    }
    return convo?.profileName || convo?.name || convo.id;
  });
}

export function useOurConversationUsername() {
  return useConversationUsername(UserUtils.getOurPubKeyStrFromCache());
}

export function useIsMe(pubkey?: string) {
  return pubkey && pubkey === UserUtils.getOurPubKeyStrFromCache();
}

export function useIsClosedGroup(convoId?: string) {
  return useSelector((state: StateType) => {
    if (!convoId) {
      return false;
    }
    const convo = state.conversations.conversationLookup[convoId];
    if (!convo) {
      return false;
    }
    return (convo.isGroup && !convo.isPublic) || false;
  });
}

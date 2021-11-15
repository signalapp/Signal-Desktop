import { useSelector } from 'react-redux';
import { UserUtils } from '../session/utils';
import { StateType } from '../state/reducer';

export function useAvatarPath(pubkey: string | undefined) {
  return useSelector((state: StateType) => {
    if (!pubkey) {
      return undefined;
    }
    return state.conversations.conversationLookup[pubkey]?.avatarPath;
  });
}

export function useOurAvatarPath() {
  return useAvatarPath(UserUtils.getOurPubKeyStrFromCache());
}

export function useConversationUsername(pubkey: string | undefined) {
  return useSelector((state: StateType) => {
    if (!pubkey) {
      return undefined;
    }
    const convo = state.conversations.conversationLookup[pubkey];
    return convo?.profileName || convo?.name || convo.id;
  });
}

export function useOurConversationUsername() {
  return useConversationUsername(UserUtils.getOurPubKeyStrFromCache());
}

import { pick } from 'lodash';
import { useSelector } from 'react-redux';
import { ConversationModel } from '../models/conversation';
import { PubKey } from '../session/types';
import { UserUtils } from '../session/utils';
import { StateType } from '../state/reducer';
import { getMessageReactsProps } from '../state/selectors/conversations';

export function useAvatarPath(convoId: string | undefined) {
  const convoProps = useConversationPropsById(convoId);
  return convoProps?.avatarPath || null;
}

export function useOurAvatarPath() {
  return useAvatarPath(UserUtils.getOurPubKeyStrFromCache());
}

/**
 *
 * @returns convo.nickname || convo.displayNameInProfile || convo.id or undefined if the convo is not found
 */
export function useConversationUsername(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);

  return convoProps?.nickname || convoProps?.displayNameInProfile || convoId;
}

/**
 * Returns either the nickname, displayNameInProfile, or the shorten pubkey
 */
export function useConversationUsernameOrShorten(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);

  return (
    convoProps?.nickname || convoProps?.displayNameInProfile || (convoId && PubKey.shorten(convoId))
  );
}

/**
 * Returns the name if that conversation.
 * This is the group name, or the realName of a user for a private conversation with a recent nickname set
 */
export function useConversationRealName(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);
  return convoProps?.isPrivate ? convoProps?.displayNameInProfile : undefined;
}

/**
 * Returns either the nickname, the profileName, in '"' or the full pubkeys given
 */
export function useConversationsUsernameWithQuoteOrFullPubkey(pubkeys: Array<string>) {
  return useSelector((state: StateType) => {
    return pubkeys.map(pubkey => {
      if (pubkey === UserUtils.getOurPubKeyStrFromCache() || pubkey.toLowerCase() === 'you') {
        return window.i18n('you');
      }
      const convo = state.conversations.conversationLookup[pubkey];
      const nameGot = convo?.displayNameInProfile;
      return nameGot?.length ? `"${nameGot}"` : pubkey;
    });
  });
}

export function useOurConversationUsername() {
  return useConversationUsername(UserUtils.getOurPubKeyStrFromCache());
}

export function useIsMe(pubkey?: string) {
  return Boolean(pubkey && pubkey === UserUtils.getOurPubKeyStrFromCache());
}

export function useIsClosedGroup(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);
  return (convoProps && convoProps.isGroup && !convoProps.isPublic) || false;
}

export function useIsPrivate(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);
  return Boolean(convoProps && convoProps.isPrivate);
}

export function useIsBlinded(convoId?: string) {
  if (!convoId) {
    return false;
  }
  return Boolean(PubKey.hasBlindedPrefix(convoId));
}

export function useHasNickname(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);
  return Boolean(convoProps && convoProps.hasNickname);
}

export function useNotificationSetting(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);
  return convoProps?.currentNotificationSetting || 'all';
}
export function useIsPublic(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);
  return Boolean(convoProps && convoProps.isPublic);
}

export function useIsBlocked(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);
  return Boolean(convoProps && convoProps.isBlocked);
}

export function useIsActive(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);
  return Boolean(convoProps && convoProps.activeAt);
}

export function useIsLeft(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);
  return Boolean(convoProps && convoProps.left);
}

export function useIsKickedFromGroup(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);
  return Boolean(convoProps && convoProps.isKickedFromGroup);
}

export function useWeAreAdmin(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);
  return Boolean(convoProps && convoProps.weAreAdmin);
}

export function useWeAreModerator(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);
  return Boolean(convoProps && (convoProps.weAreAdmin || convoProps.weAreModerator));
}

export function useExpireTimer(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);
  return convoProps && convoProps.expireTimer;
}

export function useIsPinned(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);
  return Boolean(convoProps && convoProps.isPinned);
}

export function useIsApproved(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);
  return Boolean(convoProps && convoProps.isApproved);
}

export function useIsRequest(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);
  if (!convoProps) {
    return false;
  }
  return Boolean(
    convoProps &&
      ConversationModel.hasValidIncomingRequestValues(
        pick(convoProps, ['isMe', 'isApproved', 'isPrivate', 'isBlocked', 'activeAt'])
      )
  );
}

export function useConversationPropsById(convoId?: string) {
  return useSelector((state: StateType) => {
    if (!convoId) {
      return null;
    }
    const convo = state.conversations.conversationLookup[convoId];
    if (!convo) {
      return null;
    }
    return convo;
  });
}

export function useMessageReactsPropsById(messageId?: string) {
  return useSelector((state: StateType) => {
    if (!messageId) {
      return null;
    }
    const messageReactsProps = getMessageReactsProps(state, messageId);
    if (!messageReactsProps) {
      return null;
    }
    return messageReactsProps;
  });
}

// TODO remove 10 seconds timer
export function useTimerOptionsByMode(disappearingMessageMode?: string) {
  return useSelector((state: StateType) => {
    const options = state.timerOptions.timerOptions;

    switch (disappearingMessageMode) {
      case 'deleteAfterSend':
        return options.filter(option => {
          return (
            option.value === 10 || // 10 seconds (for testing)
            option.value === 30 || // 30 seconds (for testing)
            option.value === 43200 || // 12 hours
            option.value === 86400 || // 1 day
            option.value === 604800 || // 1 week
            option.value === 1209600 // 2 weeks
          );
        });
      case 'deleteAfterRead':
        return options.filter(option => {
          return (
            option.value === 10 || // 10 seconds (for testing)
            option.value === 30 || // 30 seconds (for testing)
            option.value === 300 || // 5 minutes
            option.value === 3600 || // 1 hour
            option.value === 43200 || // 12 hours
            option.value === 86400 || // 1 day
            option.value === 604800 || // 1 week
            option.value === 1209600 // 2 weeks
          );
        });
      default:
        return options;
    }
  });
}

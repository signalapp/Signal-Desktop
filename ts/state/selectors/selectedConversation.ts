import { useSelector } from 'react-redux';
import { ConversationTypeEnum, isOpenOrClosedGroup } from '../../models/conversationAttributes';
import { PubKey } from '../../session/types';
import { ReduxConversationType } from '../ducks/conversations';
import { StateType } from '../reducer';
import { getCanWrite, getSubscriberCount } from './sogsRoomInfo';

import { createSelector } from '@reduxjs/toolkit';
import { DisappearingMessageConversationSetting } from '../../util/expiringMessages';

/**
 * Returns the formatted text for notification setting.
 */
const getCurrentNotificationSettingText = (state: StateType): string | undefined => {
  if (!state) {
    return undefined;
  }
  const currentNotificationSetting = getSelectedConversation(state)?.currentNotificationSetting;
  switch (currentNotificationSetting) {
    case 'all':
      return window.i18n('notificationForConvo_all');
    case 'mentions_only':
      return window.i18n('notificationForConvo_mentions_only');
    case 'disabled':
      return window.i18n('notificationForConvo_disabled');
    default:
      return window.i18n('notificationForConvo_all');
  }
};

const getIsSelectedPrivate = (state: StateType): boolean => {
  return Boolean(getSelectedConversation(state)?.isPrivate) || false;
};

const getIsSelectedBlocked = (state: StateType): boolean => {
  return Boolean(getSelectedConversation(state)?.isBlocked) || false;
};

const getSelectedIsApproved = (state: StateType): boolean => {
  return Boolean(getSelectedConversation(state)?.isApproved) || false;
};

const getSelectedApprovedMe = (state: StateType): boolean => {
  return Boolean(getSelectedConversation(state)?.didApproveMe) || false;
};

/**
 * Returns true if the currently selected conversation is active (has an active_at field > 0)
 */
const getIsSelectedActive = (state: StateType): boolean => {
  return Boolean(getSelectedConversation(state)?.activeAt) || false;
};

const getIsSelectedNoteToSelf = (state: StateType): boolean => {
  return getSelectedConversation(state)?.isMe || false;
};

export const getSelectedConversationKey = (state: StateType): string | undefined => {
  return state.conversations.selectedConversation;
};

export const getSelectedConversation = (state: StateType): ReduxConversationType | undefined => {
  const selected = getSelectedConversationKey(state);
  return selected ? state.conversations.conversationLookup[selected] : undefined;
};

/**
 * Returns true if the current conversation selected is a public group and false otherwise.
 */
export const getSelectedConversationIsPublic = (state: StateType): boolean => {
  return Boolean(getSelectedConversation(state)?.isPublic) || false;
};

/**
 * Returns true if the current conversation selected can be typed into
 */
export function getSelectedCanWrite(state: StateType) {
  const selectedConvoPubkey = getSelectedConversationKey(state);
  if (!selectedConvoPubkey) {
    return false;
  }
  const selectedConvo = getSelectedConversation(state);
  if (!selectedConvo) {
    return false;
  }
  const canWriteSogs = getCanWrite(state, selectedConvoPubkey);
  const { isBlocked, isKickedFromGroup, left, isPublic } = selectedConvo;

  return !(isBlocked || isKickedFromGroup || left || (isPublic && !canWriteSogs));
}

/**
 * Returns true if the current conversation selected is a group conversation.
 * Returns false if the current conversation selected is not a group conversation, or none are selected
 */
const getSelectedConversationIsGroup = (state: StateType): boolean => {
  const selected = getSelectedConversation(state);
  if (!selected || !selected.type) {
    return false;
  }
  return selected.type ? isOpenOrClosedGroup(selected.type) : false;
};

/**
 * Returns true if the current conversation selected is a closed group and false otherwise.
 */
export const isClosedGroupConversation = (state: StateType): boolean => {
  const selected = getSelectedConversation(state);
  if (!selected) {
    return false;
  }
  return (
    (selected.type === ConversationTypeEnum.GROUP && !selected.isPublic) ||
    selected.type === ConversationTypeEnum.GROUPV3 ||
    false
  );
};

const getGroupMembers = (state: StateType): Array<string> => {
  const selected = getSelectedConversation(state);
  if (!selected) {
    return [];
  }
  return selected.members || [];
};

const getSelectedSubscriberCount = (state: StateType): number | undefined => {
  const convo = getSelectedConversation(state);
  if (!convo) {
    return undefined;
  }
  return getSubscriberCount(state, convo.id);
};

// ============== SELECTORS RELEVANT TO SELECTED/OPENED CONVERSATION ==============

export function useSelectedConversationKey() {
  return useSelector(getSelectedConversationKey);
}

export function useSelectedIsGroup() {
  return useSelector(getSelectedConversationIsGroup);
}

export function useSelectedIsPublic() {
  return useSelector(getSelectedConversationIsPublic);
}

export function useSelectedIsPrivate() {
  return useSelector(getIsSelectedPrivate);
}

export function useSelectedIsBlocked() {
  return useSelector(getIsSelectedBlocked);
}

export function useSelectedIsApproved() {
  return useSelector(getSelectedIsApproved);
}

export function useSelectedApprovedMe() {
  return useSelector(getSelectedApprovedMe);
}

/**
 * Returns true if the given arguments corresponds to a private contact which is approved both sides. i.e. a friend.
 */
export function isPrivateAndFriend({
  approvedMe,
  isApproved,
  isPrivate,
}: {
  isPrivate: boolean;
  isApproved: boolean;
  approvedMe: boolean;
}) {
  return isPrivate && isApproved && approvedMe;
}

/**
 * Returns true if the selected conversation is private and is approved both sides
 */
export function useSelectedIsPrivateFriend() {
  const isPrivate = useSelectedIsPrivate();
  const isApproved = useSelectedIsApproved();
  const approvedMe = useSelectedApprovedMe();
  return isPrivateAndFriend({ isPrivate, isApproved, approvedMe });
}

export function useSelectedIsActive() {
  return useSelector(getIsSelectedActive);
}

export function useSelectedIsNoteToSelf() {
  return useSelector(getIsSelectedNoteToSelf);
}

export function useSelectedMembers() {
  return useSelector(getGroupMembers);
}

export function useSelectedSubscriberCount() {
  return useSelector(getSelectedSubscriberCount);
}

export function useSelectedNotificationSetting() {
  return useSelector(getCurrentNotificationSettingText);
}

export function useSelectedIsKickedFromGroup() {
  return useSelector(
    (state: StateType) => Boolean(getSelectedConversation(state)?.isKickedFromGroup) || false
  );
}

export function useSelectedExpireTimer(): number | undefined {
  return useSelector((state: StateType) => getSelectedConversation(state)?.expireTimer);
}

export function useSelectedExpirationType(): string | undefined {
  return useSelector((state: StateType) => getSelectedConversation(state)?.expirationType);
}

export function useSelectedIsLeft() {
  return useSelector((state: StateType) => Boolean(getSelectedConversation(state)?.left) || false);
}

export function useSelectedNickname() {
  return useSelector((state: StateType) => getSelectedConversation(state)?.nickname);
}

export function useSelectedDisplayNameInProfile() {
  return useSelector((state: StateType) => getSelectedConversation(state)?.displayNameInProfile);
}

/**
 * For a private chat, this returns the (xxxx...xxxx) shortened pubkey
 * If this is a private chat, but somehow, we have no pubkey, this returns the localized `anonymous` string
 * Otherwise, this returns the localized `unknown` string
 */
export function useSelectedShortenedPubkeyOrFallback() {
  const isPrivate = useSelectedIsPrivate();
  const selected = useSelectedConversationKey();
  if (isPrivate && selected) {
    return PubKey.shorten(selected);
  }
  if (isPrivate) {
    return window.i18n('anonymous');
  }
  return window.i18n('unknown');
}

/**
 * That's a very convoluted way to say "nickname or profile name or shortened pubkey or ("Anonymous" or "unknown" depending on the type of conversation).
 * This also returns the localized "Note to Self" if the conversation is the note to self.
 */
export function useSelectedNicknameOrProfileNameOrShortenedPubkey() {
  const nickname = useSelectedNickname();
  const profileName = useSelectedDisplayNameInProfile();
  const shortenedPubkey = useSelectedShortenedPubkeyOrFallback();
  const isMe = useSelectedIsNoteToSelf();
  if (isMe) {
    return window.i18n('noteToSelf');
  }
  return nickname || profileName || shortenedPubkey;
}

export function useSelectedWeAreAdmin() {
  return useSelector((state: StateType) => getSelectedConversation(state)?.weAreAdmin || false);
}

export const getSelectedConversationExpirationModes = createSelector(
  getSelectedConversation,
  (convo: ReduxConversationType | undefined) => {
    if (!convo) {
      return null;
    }
    let modes = DisappearingMessageConversationSetting;
    // TODO legacy messages support will be removed in a future release
    // TODO remove legacy mode
    modes = modes.slice(0, -1);

    // Note to Self and Closed Groups only support deleteAfterSend
    const isClosedGroup = !convo.isPrivate && !convo.isPublic;
    if (convo?.isMe || isClosedGroup) {
      modes = [modes[0], modes[2]];
    }

    const modesWithDisabledState: Record<string, boolean> = {};
    if (modes && modes.length > 1) {
      modes.forEach(mode => {
        modesWithDisabledState[mode] = isClosedGroup ? !convo.weAreAdmin : false;
      });
    }

    return modesWithDisabledState;
  }
);

// TODO legacy messages support will be removed in a future release
export const getSelectedConversationExpirationModesWithLegacy = createSelector(
  getSelectedConversation,
  (convo: ReduxConversationType | undefined) => {
    // this just won't happen
    if (!convo) {
      return null;
    }
    let modes = DisappearingMessageConversationSetting;

    // Note to Self and Closed Groups only support deleteAfterSend and legacy modes
    const isClosedGroup = !convo.isPrivate && !convo.isPublic;
    if (convo?.isMe || isClosedGroup) {
      modes = [modes[0], ...modes.slice(2)];
    }

    // Legacy mode is the 2nd option in the UI
    modes = [modes[0], modes[modes.length - 1], ...modes.slice(1, modes.length - 1)];

    // TODO it would be nice to type those with something else that string but it causes a lot of issues
    const modesWithDisabledState: Record<string, boolean> = {};
    // The new modes are disabled by default
    if (modes && modes.length > 1) {
      modes.forEach(mode => {
        modesWithDisabledState[mode] = Boolean(
          (mode !== 'legacy' && mode !== 'off') || (isClosedGroup && !convo.weAreAdmin)
        );
      });
    }

    return modesWithDisabledState;
  }
);

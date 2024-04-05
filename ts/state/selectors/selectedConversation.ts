import { isString } from 'lodash';
import { useSelector } from 'react-redux';
import { useUnreadCount } from '../../hooks/useParamSelector';
import { ConversationTypeEnum, isOpenOrClosedGroup } from '../../models/conversationAttributes';
import {
  DisappearingMessageConversationModeType,
  DisappearingMessageConversationModes,
} from '../../session/disappearing_messages/types';
import { PubKey } from '../../session/types';
import { UserUtils } from '../../session/utils';
import { ReleasedFeatures } from '../../util/releaseFeature';
import { ReduxConversationType } from '../ducks/conversations';
import { StateType } from '../reducer';
import {
  getIsMessageSelectionMode,
  getSelectedConversation,
  getSelectedMessageIds,
} from './conversations';
import { getCanWrite, getModerators, getSubscriberCount } from './sogsRoomInfo';

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

  const readOnlySogs = isPublic && !canWriteSogs;

  const isBlindedAndDisabledMsgRequests = getSelectedBlindedDisabledMsgRequests(state); // true if isPrivate, blinded and explicitely disabled msgreq

  return !(
    isBlocked ||
    isKickedFromGroup ||
    left ||
    readOnlySogs ||
    isBlindedAndDisabledMsgRequests
  );
}

function getSelectedBlindedDisabledMsgRequests(state: StateType) {
  const selectedConvoPubkey = getSelectedConversationKey(state);
  if (!selectedConvoPubkey) {
    return false;
  }
  const selectedConvo = getSelectedConversation(state);
  if (!selectedConvo) {
    return false;
  }
  const { blocksSogsMsgReqsTimestamp, isPrivate } = selectedConvo;

  const isBlindedAndDisabledMsgRequests = Boolean(
    isPrivate && PubKey.isBlinded(selectedConvoPubkey) && blocksSogsMsgReqsTimestamp
  );

  return isBlindedAndDisabledMsgRequests;
}

const getSelectedConversationType = (state: StateType): ConversationTypeEnum | null => {
  const selected = getSelectedConversation(state);
  if (!selected || !selected.type) {
    return null;
  }
  return selected.type;
};

const getSelectedConversationIsGroupOrCommunity = (state: StateType): boolean => {
  const type = getSelectedConversationType(state);
  return type ? isOpenOrClosedGroup(type) : false;
};

const getSelectedConversationIsGroupV2 = (state: StateType): boolean => {
  const selected = getSelectedConversation(state);
  if (!selected || !selected.type) {
    return false;
  }
  return selected.type === ConversationTypeEnum.GROUPV3;
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

const getSelectedGroupMembers = (state: StateType): Array<string> => {
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

// TODO legacy messages support will be removed in a future release
const getSelectedConversationExpirationModesWithLegacy = (convo: ReduxConversationType) => {
  if (!convo) {
    return undefined;
  }

  // NOTE this needs to be as any because the number of modes can change depending on if v2 is released or we are in single mode
  let modes: any = DisappearingMessageConversationModes;

  // Note to Self and Closed Groups only support deleteAfterSend and legacy modes
  const isClosedGroup = !convo.isPrivate && !convo.isPublic;
  if (convo?.isMe || isClosedGroup) {
    modes = [modes[0], ...modes.slice(2)];
  }

  // Legacy mode is the 2nd option in the UI
  modes = [modes[0], modes[modes.length - 1], ...modes.slice(1, modes.length - 1)];

  const modesWithDisabledState: Record<string, boolean> = {};
  // The new modes are disabled by default
  if (modes && modes.length > 1) {
    modes.forEach((mode: any) => {
      modesWithDisabledState[mode] = Boolean(mode !== 'legacy' && mode !== 'off');
    });
  }

  return modesWithDisabledState;
};

export const getSelectedConversationExpirationModes = (state: StateType) => {
  const convo = getSelectedConversation(state);
  if (!convo) {
    return undefined;
  }

  if (!ReleasedFeatures.isDisappearMessageV2FeatureReleasedCached()) {
    return getSelectedConversationExpirationModesWithLegacy(convo);
  }

  // NOTE this needs to be as any because the number of modes can change depending on if v2 is released or we are in single mode
  let modes: any = DisappearingMessageConversationModes;
  // TODO legacy messages support will be removed in a future release
  // TODO remove legacy mode
  modes = modes.slice(0, -1);

  // Note to Self and Closed Groups only support deleteAfterSend
  const isClosedGroup = !convo.isPrivate && !convo.isPublic;
  if (convo?.isMe || isClosedGroup) {
    modes = [modes[0], modes[2]];
  }

  // NOTE disabled = true
  const modesWithDisabledState: Record<string, boolean> = {};
  if (modes && modes.length > 1) {
    modes.forEach((mode: any) => {
      modesWithDisabledState[mode] = isClosedGroup ? !convo.weAreAdmin : false;
    });
  }

  return modesWithDisabledState;
};

// ============== SELECTORS RELEVANT TO SELECTED/OPENED CONVERSATION ==============

export function useSelectedConversationKey() {
  return useSelector(getSelectedConversationKey);
}

export function useSelectedIsGroupOrCommunity() {
  return useSelector(getSelectedConversationIsGroupOrCommunity);
}

export function useSelectedIsGroupV2() {
  return useSelector(getSelectedConversationIsGroupV2);
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

export function useSelectedHasDisabledBlindedMsgRequests() {
  return useSelector(getSelectedBlindedDisabledMsgRequests);
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

export function useSelectedUnreadCount() {
  const selectedConversation = useSelectedConversationKey();
  return useUnreadCount(selectedConversation);
}

export function useSelectedIsNoteToSelf() {
  return useSelector(getIsSelectedNoteToSelf);
}

export function useSelectedMembers() {
  return useSelector(getSelectedGroupMembers);
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

export function useSelectedConversationDisappearingMode():
  | DisappearingMessageConversationModeType
  | undefined {
  return useSelector((state: StateType) => getSelectedConversation(state)?.expirationMode);
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

/**
 * Only for communities.
 * @returns true if the selected convo is a community and we are one of the moderators
 */
export function useSelectedWeAreModerator() {
  // TODO might be something to memoize let's see
  const isPublic = useSelectedIsPublic();
  const selectedConvoKey = useSelectedConversationKey();
  const us = UserUtils.getOurPubKeyStrFromCache();
  const mods = useSelector((state: StateType) => getModerators(state, selectedConvoKey));

  const weAreModerator = mods.includes(us);
  return isPublic && isString(selectedConvoKey) && weAreModerator;
}

export function useIsMessageSelectionMode() {
  return useSelector(getIsMessageSelectionMode);
}

export function useSelectedLastMessage() {
  return useSelector((state: StateType) => getSelectedConversation(state)?.lastMessage);
}

export function useSelectedMessageIds() {
  return useSelector(getSelectedMessageIds);
}

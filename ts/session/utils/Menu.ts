export function showTimerOptions(
  isPublic: boolean,
  isRss: boolean,
  isKickedFromGroup: boolean,
  isBlocked: boolean
): boolean {
  return (
    Boolean(!isPublic) && Boolean(!isRss) && !isKickedFromGroup && !isBlocked
  );
}

export function showMemberMenu(
  isPublic: boolean,
  isRss: boolean,
  isGroup: boolean
): boolean {
  return Boolean(!isPublic) && Boolean(!isRss) && isGroup;
}

export function showSafetyNumber(
  isPublic: boolean,
  isRss: boolean,
  isGroup: boolean,
  isMe: boolean
): boolean {
  return Boolean(!isPublic) && Boolean(!isRss) && !isGroup && !isMe;
}

export function showResetSession(
  isPublic: boolean,
  isRss: boolean,
  isGroup: boolean
): boolean {
  return Boolean(!isPublic) && Boolean(!isRss) && Boolean(!isGroup);
}

export function showBlock(
  isMe: boolean | undefined,
  isPrivate: boolean | undefined
): boolean {
  return Boolean(!isMe) && Boolean(isPrivate);
}

export function showClearNickname(
  isPublic: boolean | undefined,
  isRss: boolean | undefined,
  isMe: boolean | undefined,
  hasNickname: boolean | undefined
): boolean {
  return (
    Boolean(!isPublic) &&
    Boolean(!isRss) &&
    Boolean(!isMe) &&
    Boolean(hasNickname)
  );
}

export function showCopyId(
  isPublic: boolean | undefined,
  isRss: boolean | undefined
): boolean {
  return Boolean(!isPublic) && Boolean(!isRss);
}

export function showDeleteContact(
  isMe: boolean | undefined,
  isClosable: boolean | undefined,
  isGroup: boolean | undefined,
  isPublic: boolean | undefined,
  isRss: boolean | undefined
): boolean {
  return (
    Boolean(!isMe) && Boolean(isClosable) && !!(!isGroup || isPublic || isRss)
  );
}

export function showAddModerators(
  amMod: boolean | undefined,
  isKickedFromGroup: boolean | undefined
): boolean {
  return Boolean(!isKickedFromGroup) && Boolean(amMod);
}

export function showRemoveModerators(
  amMod: boolean | undefined,
  isKickedFromGroup: boolean | undefined
): boolean {
  return Boolean(!isKickedFromGroup) && Boolean(amMod);
}
export function showUpdateGroupName(
  amMod: boolean | undefined,
  isKickedFromGroup: boolean | undefined
): boolean {
  return Boolean(!isKickedFromGroup) && Boolean(amMod);
}

export function showLeaveGroup(
  isKickedFromGroup: boolean | undefined,
  isGroup: boolean | undefined,
  isPublic: boolean | undefined,
  isRss: boolean | undefined
): boolean {
  return Boolean(!isKickedFromGroup) && !!(!isGroup || isPublic || isRss);
}

export function showInviteContact(
  isGroup: boolean | undefined,
  isPublic: boolean | undefined
): boolean {
  return Boolean(isGroup) && Boolean(isPublic);
}

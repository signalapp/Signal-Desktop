import React from 'react';
import { MenuItem, SubMenu } from 'react-contextmenu';
import { LocalizerType } from '../../types/Util';
import { TimerOption } from '../../components/conversation/ConversationHeader';

function showTimerOptions(
  isPublic: boolean,
  isRss: boolean,
  isKickedFromGroup: boolean,
  isBlocked: boolean
): boolean {
  return !isPublic && !isRss && !isKickedFromGroup && !isBlocked;
}

function showMemberMenu(
  isPublic: boolean,
  isRss: boolean,
  isGroup: boolean
): boolean {
  return !isPublic && !isRss && isGroup;
}

function showSafetyNumber(
  isPublic: boolean,
  isRss: boolean,
  isGroup: boolean,
  isMe: boolean
): boolean {
  return !isPublic && !isRss && !isGroup && !isMe;
}

function showResetSession(
  isPublic: boolean,
  isRss: boolean,
  isGroup: boolean
): boolean {
  return !isPublic && !isRss && !isGroup;
}

function showBlock(isMe: boolean, isPrivate: boolean): boolean {
  return !isMe && isPrivate;
}

function showClearNickname(
  isPublic: boolean,
  isRss: boolean,
  isMe: boolean,
  hasNickname: boolean
): boolean {
  return !isPublic && !isRss && !isMe && hasNickname;
}

function showDeleteMessages(isPublic: boolean): boolean {
  return !isPublic;
}

function showCopyId(isPublic: boolean, isRss: boolean, isGroup: boolean): boolean {
  return !isGroup && !isRss;
}

function showDeleteContact(
  isMe: boolean,
  isClosable: boolean,
  isGroup: boolean,
  isPublic: boolean,
  isRss: boolean
): boolean {
  return !isMe && isClosable && !!(!isGroup || isPublic || isRss);
}

function showAddModerators(
  amMod: boolean,
  isKickedFromGroup: boolean
): boolean {
  return !isKickedFromGroup && amMod;
}

function showRemoveModerators(
  amMod: boolean,
  isKickedFromGroup: boolean
): boolean {
  return !isKickedFromGroup && amMod;
}

function showUpdateGroupName(
  amMod: boolean,
  isKickedFromGroup: boolean
): boolean {
  return !isKickedFromGroup && amMod;
}

function showLeaveGroup(
  isKickedFromGroup: boolean,
  isGroup: boolean,
  isPublic: boolean,
  isRss: boolean
): boolean {
  return !isKickedFromGroup && isGroup && !isPublic && !isRss;
}

function showInviteContact(isGroup: boolean, isPublic: boolean): boolean {
  return isGroup && isPublic;
}

/** Menu items standardized */

export function getInviteContactMenuItem(
  isGroup: boolean | undefined,
  isPublic: boolean | undefined,
  action: any,
  i18n: LocalizerType
): JSX.Element | null {
  if (showInviteContact(Boolean(isGroup), Boolean(isPublic))) {
    return <MenuItem onClick={action}>{i18n('inviteContacts')}</MenuItem>;
  }
  return null;
}

export function getDeleteContactMenuItem(
  isMe: boolean | undefined,
  isClosable: boolean | undefined,
  isGroup: boolean | undefined,
  isPublic: boolean | undefined,
  isRss: boolean | undefined,
  action: any,
  i18n: LocalizerType
): JSX.Element | null {
  if (
    showDeleteContact(
      Boolean(isMe),
      Boolean(isClosable),
      Boolean(isGroup),
      Boolean(isPublic),
      Boolean(isRss)
    )
  ) {
    if (isPublic) {
      return <MenuItem onClick={action}>{i18n('leaveGroup')}</MenuItem>;
    }
    return <MenuItem onClick={action}>{i18n('deleteContact')}</MenuItem>;
  }
  return null;
}

export function getLeaveGroupMenuItem(
  isKickedFromGroup: boolean | undefined,
  isGroup: boolean | undefined,
  isPublic: boolean | undefined,
  isRss: boolean | undefined,
  action: any,
  i18n: LocalizerType
): JSX.Element | null {
  if (
    showLeaveGroup(
      Boolean(isKickedFromGroup),
      Boolean(isGroup),
      Boolean(isPublic),
      Boolean(isRss)
    )
  ) {
    return <MenuItem onClick={action}>{i18n('leaveGroup')}</MenuItem>;
  }
  return null;
}

export function getUpdateGroupNameMenuItem(
  amMod: boolean | undefined,
  isKickedFromGroup: boolean | undefined,
  action: any,
  i18n: LocalizerType
): JSX.Element | null {
  if (showUpdateGroupName(Boolean(amMod), Boolean(isKickedFromGroup))) {
    return (
      <MenuItem onClick={action}>{i18n('editGroupNameOrPicture')}</MenuItem>
    );
  }
  return null;
}

export function getRemoveModeratorsMenuItem(
  amMod: boolean | undefined,
  isKickedFromGroup: boolean | undefined,
  action: any,
  i18n: LocalizerType
): JSX.Element | null {
  if (showRemoveModerators(Boolean(amMod), Boolean(isKickedFromGroup))) {
    return <MenuItem onClick={action}>{i18n('removeModerators')}</MenuItem>;
  }
  return null;
}

export function getAddModeratorsMenuItem(
  amMod: boolean | undefined,
  isKickedFromGroup: boolean | undefined,
  action: any,
  i18n: LocalizerType
): JSX.Element | null {
  if (showAddModerators(Boolean(amMod), Boolean(isKickedFromGroup))) {
    return <MenuItem onClick={action}>{i18n('addModerators')}</MenuItem>;
  }
  return null;
}

export function getCopyMenuItem(
  isPublic: boolean | undefined,
  isRss: boolean | undefined,
  isGroup: boolean | undefined,
  action: any,
  i18n: LocalizerType
): JSX.Element | null {
  if (showCopyId(Boolean(isPublic), Boolean(isRss), Boolean(isGroup))) {
    const copyIdLabel = i18n('editMenuCopy');
    return <MenuItem onClick={action}>{copyIdLabel}</MenuItem>;
  }
  return null;
}

export function getDisappearingMenuItem(
  isPublic: boolean | undefined,
  isRss: boolean | undefined,
  isKickedFromGroup: boolean | undefined,
  isBlocked: boolean | undefined,
  timerOptions: Array<TimerOption>,
  action: any,
  i18n: LocalizerType
): JSX.Element | null {
  if (
    showTimerOptions(
      Boolean(isPublic),
      Boolean(isRss),
      Boolean(isKickedFromGroup),
      Boolean(isBlocked)
    )
  ) {
    return (
      <SubMenu title={i18n('disappearingMessages') as any}>
        {(timerOptions || []).map(item => (
          <MenuItem
            key={item.value}
            onClick={() => {
              action(item.value);
            }}
          >
            {item.name}
          </MenuItem>
        ))}
      </SubMenu>
    );
  }
  return null;
}

export function getShowMemberMenuItem(
  isPublic: boolean | undefined,
  isRss: boolean | undefined,
  isGroup: boolean | undefined,
  action: any,
  i18n: LocalizerType
): JSX.Element | null {
  if (showMemberMenu(Boolean(isPublic), Boolean(isRss), Boolean(isGroup))) {
    return <MenuItem onClick={action}>{i18n('showMembers')}</MenuItem>;
  }
  return null;
}

export function getShowSafetyNumberMenuItem(
  isPublic: boolean | undefined,
  isRss: boolean | undefined,
  isGroup: boolean | undefined,
  isMe: boolean | undefined,
  action: any,
  i18n: LocalizerType
): JSX.Element | null {
  if (
    showSafetyNumber(
      Boolean(isPublic),
      Boolean(isRss),
      Boolean(isGroup),
      Boolean(isMe)
    )
  ) {
    return <MenuItem onClick={action}>{i18n('showSafetyNumber')}</MenuItem>;
  }
  return null;
}

export function getResetSessionMenuItem(
  isPublic: boolean | undefined,
  isRss: boolean | undefined,
  isGroup: boolean | undefined,
  action: any,
  i18n: LocalizerType
): JSX.Element | null {
  if (showResetSession(Boolean(isPublic), Boolean(isRss), Boolean(isGroup))) {
    return <MenuItem onClick={action}>{i18n('resetSession')}</MenuItem>;
  }
  return null;
}

export function getBlockMenuItem(
  isMe: boolean | undefined,
  isPrivate: boolean | undefined,
  isBlocked: boolean | undefined,
  actionBlock: any,
  actionUnblock: any,
  i18n: LocalizerType
): JSX.Element | null {
  if (showBlock(Boolean(isMe), Boolean(isPrivate))) {
    const blockTitle = isBlocked ? i18n('unblockUser') : i18n('blockUser');
    const blockHandler = isBlocked ? actionUnblock : actionBlock;
    return <MenuItem onClick={blockHandler}>{blockTitle}</MenuItem>;
  }
  return null;
}

export function getClearNicknameMenuItem(
  isPublic: boolean | undefined,
  isRss: boolean | undefined,
  isMe: boolean | undefined,
  hasNickname: boolean | undefined,
  action: any,
  i18n: LocalizerType
): JSX.Element | null {
  if (
    showClearNickname(
      Boolean(isPublic),
      Boolean(isRss),
      Boolean(isMe),
      Boolean(hasNickname)
    )
  ) {
    return <MenuItem onClick={action}>{i18n('clearNickname')}</MenuItem>;
  }
  return null;
}

export function getDeleteMessagesMenuItem(
  isPublic: boolean | undefined,
  action: any,
  i18n: LocalizerType
): JSX.Element | null {
  if (showDeleteMessages(Boolean(isPublic))) {
    return <MenuItem onClick={action}>{i18n('deleteMessages')}</MenuItem>;
  }
  return null;
}

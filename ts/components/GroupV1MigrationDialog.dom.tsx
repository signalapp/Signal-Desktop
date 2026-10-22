// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useCallback, useMemo, type ReactNode } from 'react';
import type { LocalizerType, ThemeType } from '../types/Util.std.ts';
import type { ConversationType } from '../state/ducks/conversations.preload.ts';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges.preload.ts';
import { Avatar, AvatarSize } from './Avatar.dom.tsx';
import { UserText } from './UserText.dom.tsx';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import { AxoContactList } from '../axo/items/AxoContactList.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';
import { sortByTitle } from '../util/sortByTitle.std.ts';
import { missingCaseError } from '../util/missingCaseError.std.ts';

export type GroupV1MigrationDialogProps = Readonly<{
  i18n: LocalizerType;
  areWeInvited: boolean;
  droppedMembers: ReadonlyArray<ConversationType> | null;
  droppedMemberCount: number;
  invitedMembers: ReadonlyArray<ConversationType> | null;
  invitedMemberCount: number;
  getPreferredBadge: PreferredBadgeSelectorType;
  theme: ThemeType;
  onClose: () => void;
}>;

export function GroupV1MigrationDialog(
  props: GroupV1MigrationDialogProps
): ReactNode {
  const { i18n, onClose } = props;

  const handleOpenChange = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <AxoDialog.Root open onOpenChange={handleOpenChange}>
      <AxoDialog.Content size="sm" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title>
            {i18n('icu:GroupV1--Migration--info--title')}
          </AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body padding="md">
          <AxoDialog.Description>
            <p className={tw('mb-2.5 px-2')}>
              {i18n('icu:GroupV1--Migration--info--summary')}
            </p>
            <p className={tw('mb-2.5 px-2')}>
              {i18n('icu:GroupV1--Migration--info--keep-history')}
            </p>
          </AxoDialog.Description>
          {props.areWeInvited ? (
            <p className={tw('mb-2.5 px-2')}>
              {i18n('icu:GroupV1--Migration--info--invited--you')}
            </p>
          ) : (
            <>
              <GroupV1MigrationMembers
                i18n={i18n}
                kind="invited"
                members={props.invitedMembers}
                count={props.invitedMemberCount}
                getPreferredBadge={props.getPreferredBadge}
                theme={props.theme}
              />
              <GroupV1MigrationMembers
                i18n={i18n}
                kind="dropped"
                members={props.droppedMembers}
                count={props.droppedMemberCount}
                getPreferredBadge={props.getPreferredBadge}
                theme={props.theme}
              />
            </>
          )}
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action
              variant="strong-primary"
              onClick={onClose}
              autoFocus
            >
              {i18n('icu:ok')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

type GroupV1MigrationMembersProps = Readonly<{
  i18n: LocalizerType;
  kind: 'invited' | 'dropped';
  members: ReadonlyArray<ConversationType> | null;
  count: number;
  getPreferredBadge: PreferredBadgeSelectorType;
  theme: ThemeType;
}>;

function GroupV1MigrationMembers(
  props: GroupV1MigrationMembersProps
): ReactNode {
  const { i18n, members } = props;

  const sortedMembers = useMemo(() => {
    return members != null ? sortByTitle(members) : null;
  }, [members]);

  if (props.count === 0) {
    return null;
  }

  if (sortedMembers == null) {
    let countText: string;
    if (props.kind === 'invited') {
      countText = i18n('icu:GroupV1--Migration--info--invited--count', {
        count: props.count,
      });
    } else {
      countText = i18n('icu:GroupV1--Migration--info--removed--after--count', {
        count: props.count,
      });
    }

    return <p className={tw('mb-2.5 px-2')}>{countText}</p>;
  }

  let text: string;
  switch (props.kind) {
    case 'invited':
      text =
        sortedMembers.length === 1
          ? i18n('icu:GroupV1--Migration--info--invited--one')
          : i18n('icu:GroupV1--Migration--info--invited--many');
      break;
    case 'dropped':
      text =
        sortedMembers.length === 1
          ? i18n('icu:GroupV1--Migration--info--removed--after--one')
          : i18n('icu:GroupV1--Migration--info--removed--after--many');
      break;
    default:
      throw missingCaseError(props.kind);
  }

  return (
    <div className={tw('mb-2.5')}>
      <p className={tw('mb-2.5 px-2')}>{text}</p>
      <AxoContactList.Root>
        {sortedMembers.map(member => {
          return (
            <AxoContactList.Item
              key={member.id}
              avatar={
                <Avatar
                  i18n={i18n}
                  avatarPlaceholderGradient={member.avatarPlaceholderGradient}
                  avatarUrl={member.avatarUrl}
                  badge={props.getPreferredBadge(member.badges)}
                  color={member.color}
                  conversationType={member.type}
                  hasAvatar={member.hasAvatar}
                  noteToSelf={member.isMe}
                  size={AvatarSize.THIRTY_TWO}
                  theme={props.theme}
                  title={member.title}
                />
              }
              title={<UserText text={member.title} />}
            />
          );
        })}
      </AxoContactList.Root>
    </div>
  );
}

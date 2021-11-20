// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { LocalizerType, ThemeType } from '../types/Util';
import type { ConversationType } from '../state/ducks/conversations';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import { GroupDialog } from './GroupDialog';
import { sortByTitle } from '../util/sortByTitle';

type CallbackType = () => unknown;

export type DataPropsType = {
  readonly areWeInvited: boolean;
  readonly droppedMembers: Array<ConversationType>;
  readonly hasMigrated: boolean;
  readonly invitedMembers: Array<ConversationType>;
  readonly migrate: CallbackType;
  readonly onClose: CallbackType;
};

export type HousekeepingPropsType = {
  readonly getPreferredBadge: PreferredBadgeSelectorType;
  readonly i18n: LocalizerType;
  readonly theme: ThemeType;
};

export type PropsType = DataPropsType & HousekeepingPropsType;

export const GroupV1MigrationDialog: React.FunctionComponent<PropsType> =
  React.memo((props: PropsType) => {
    const {
      areWeInvited,
      droppedMembers,
      getPreferredBadge,
      hasMigrated,
      i18n,
      invitedMembers,
      migrate,
      onClose,
      theme,
    } = props;

    const title = hasMigrated
      ? i18n('GroupV1--Migration--info--title')
      : i18n('GroupV1--Migration--migrate--title');
    const keepHistory = hasMigrated
      ? i18n('GroupV1--Migration--info--keep-history')
      : i18n('GroupV1--Migration--migrate--keep-history');
    const migrationKey = hasMigrated ? 'after' : 'before';
    const droppedMembersKey = `GroupV1--Migration--info--removed--${migrationKey}`;

    let primaryButtonText: string;
    let onClickPrimaryButton: () => void;
    let secondaryButtonProps:
      | undefined
      | {
          secondaryButtonText: string;
          onClickSecondaryButton: () => void;
        };
    if (hasMigrated) {
      primaryButtonText = i18n('Confirmation--confirm');
      onClickPrimaryButton = onClose;
    } else {
      primaryButtonText = i18n('GroupV1--Migration--migrate');
      onClickPrimaryButton = migrate;
      secondaryButtonProps = {
        secondaryButtonText: i18n('cancel'),
        onClickSecondaryButton: onClose,
      };
    }

    return (
      <GroupDialog
        i18n={i18n}
        onClickPrimaryButton={onClickPrimaryButton}
        onClose={onClose}
        primaryButtonText={primaryButtonText}
        title={title}
        {...secondaryButtonProps}
      >
        <GroupDialog.Paragraph>
          {i18n('GroupV1--Migration--info--summary')}
        </GroupDialog.Paragraph>
        <GroupDialog.Paragraph>{keepHistory}</GroupDialog.Paragraph>
        {areWeInvited ? (
          <GroupDialog.Paragraph>
            {i18n('GroupV1--Migration--info--invited--you')}
          </GroupDialog.Paragraph>
        ) : (
          <>
            {renderMembers({
              getPreferredBadge,
              i18n,
              members: invitedMembers,
              prefix: 'GroupV1--Migration--info--invited',
              theme,
            })}
            {renderMembers({
              getPreferredBadge,
              i18n,
              members: droppedMembers,
              prefix: droppedMembersKey,
              theme,
            })}
          </>
        )}
      </GroupDialog>
    );
  });

function renderMembers({
  getPreferredBadge,
  i18n,
  members,
  prefix,
  theme,
}: Readonly<{
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  members: Array<ConversationType>;
  prefix: string;
  theme: ThemeType;
}>): React.ReactNode {
  if (!members.length) {
    return null;
  }

  const postfix = members.length === 1 ? '--one' : '--many';
  const key = `${prefix}${postfix}`;

  return (
    <>
      <GroupDialog.Paragraph>{i18n(key)}</GroupDialog.Paragraph>
      <GroupDialog.Contacts
        contacts={sortByTitle(members)}
        getPreferredBadge={getPreferredBadge}
        i18n={i18n}
        theme={theme}
      />
    </>
  );
}

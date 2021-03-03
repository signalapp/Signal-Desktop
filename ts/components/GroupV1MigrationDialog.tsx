// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { LocalizerType } from '../types/Util';
import { ConversationType } from '../state/ducks/conversations';
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
  readonly i18n: LocalizerType;
};

export type PropsType = DataPropsType & HousekeepingPropsType;

export const GroupV1MigrationDialog: React.FunctionComponent<PropsType> = React.memo(
  (props: PropsType) => {
    const {
      areWeInvited,
      droppedMembers,
      hasMigrated,
      i18n,
      invitedMembers,
      migrate,
      onClose,
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
            {renderMembers(
              invitedMembers,
              'GroupV1--Migration--info--invited',
              i18n
            )}
            {renderMembers(droppedMembers, droppedMembersKey, i18n)}
          </>
        )}
      </GroupDialog>
    );
  }
);

function renderMembers(
  members: Array<ConversationType>,
  prefix: string,
  i18n: LocalizerType
): React.ReactNode {
  if (!members.length) {
    return null;
  }

  const postfix = members.length === 1 ? '--one' : '--many';
  const key = `${prefix}${postfix}`;

  return (
    <>
      <GroupDialog.Paragraph>{i18n(key)}</GroupDialog.Paragraph>
      <GroupDialog.Contacts contacts={sortByTitle(members)} i18n={i18n} />
    </>
  );
}

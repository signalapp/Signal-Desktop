// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { LocalizerType, ThemeType } from '../types/Util';
import type { ConversationType } from '../state/ducks/conversations';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import { GroupDialog } from './GroupDialog';
import { sortByTitle } from '../util/sortByTitle';

export type DataPropsType = {
  conversationId: string;
  readonly areWeInvited: boolean;
  readonly droppedMembers: Array<ConversationType>;
  readonly hasMigrated: boolean;
  readonly invitedMembers: Array<ConversationType>;
  readonly getPreferredBadge: PreferredBadgeSelectorType;
  readonly i18n: LocalizerType;
  readonly theme: ThemeType;
};

type ActionsPropsType =
  | {
      initiateMigrationToGroupV2: (conversationId: string) => unknown;
      closeGV2MigrationDialog: () => unknown;
    }
  | {
      readonly migrate: () => unknown;
      readonly onClose: () => unknown;
    };

export type PropsType = DataPropsType & ActionsPropsType;

export const GroupV1MigrationDialog: React.FunctionComponent<PropsType> =
  React.memo(function GroupV1MigrationDialogInner(props: PropsType) {
    const {
      areWeInvited,
      conversationId,
      droppedMembers,
      getPreferredBadge,
      hasMigrated,
      i18n,
      invitedMembers,
      theme,
    } = props;

    let migrateHandler;
    if ('migrate' in props) {
      migrateHandler = props.migrate;
    } else if ('initiateMigrationToGroupV2' in props) {
      migrateHandler = () => props.initiateMigrationToGroupV2(conversationId);
    } else {
      throw new Error(
        'GroupV1MigrationDialog: No conversationId or migration function'
      );
    }

    let closeHandler;
    if ('onClose' in props) {
      closeHandler = props.onClose;
    } else if ('closeGV2MigrationDialog' in props) {
      closeHandler = props.closeGV2MigrationDialog;
    } else {
      throw new Error('GroupV1MigrationDialog: No close function provided');
    }

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
      onClickPrimaryButton = closeHandler;
    } else {
      primaryButtonText = i18n('GroupV1--Migration--migrate');
      onClickPrimaryButton = migrateHandler;
      secondaryButtonProps = {
        secondaryButtonText: i18n('cancel'),
        onClickSecondaryButton: closeHandler,
      };
    }

    return (
      <GroupDialog
        i18n={i18n}
        onClickPrimaryButton={onClickPrimaryButton}
        onClose={closeHandler}
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

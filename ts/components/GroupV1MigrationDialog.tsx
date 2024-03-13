// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { LocalizerType, ThemeType } from '../types/Util';
import type { ConversationType } from '../state/ducks/conversations';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import { GroupDialog } from './GroupDialog';
import { sortByTitle } from '../util/sortByTitle';
import { missingCaseError } from '../util/missingCaseError';

export type DataPropsType = {
  readonly areWeInvited: boolean;
  readonly droppedMembers: Array<ConversationType>;
  readonly hasMigrated: boolean;
  readonly invitedMembers: Array<ConversationType>;
  readonly getPreferredBadge: PreferredBadgeSelectorType;
  readonly i18n: LocalizerType;
  readonly theme: ThemeType;
};

type ActionsPropsType = Readonly<{
  onMigrate: () => unknown;
  onClose: () => unknown;
}>;

export type PropsType = DataPropsType & ActionsPropsType;

export const GroupV1MigrationDialog: React.FunctionComponent<PropsType> =
  React.memo(function GroupV1MigrationDialogInner({
    areWeInvited,
    droppedMembers,
    getPreferredBadge,
    hasMigrated,
    i18n,
    invitedMembers,
    theme,
    onClose,
    onMigrate,
  }: PropsType) {
    const title = hasMigrated
      ? i18n('icu:GroupV1--Migration--info--title')
      : i18n('icu:GroupV1--Migration--migrate--title');
    const keepHistory = hasMigrated
      ? i18n('icu:GroupV1--Migration--info--keep-history')
      : i18n('icu:GroupV1--Migration--migrate--keep-history');

    let primaryButtonText: string;
    let onClickPrimaryButton: () => void;
    let secondaryButtonProps:
      | undefined
      | {
          secondaryButtonText: string;
          onClickSecondaryButton: () => void;
        };
    if (hasMigrated) {
      primaryButtonText = i18n('icu:Confirmation--confirm');
      onClickPrimaryButton = onClose;
    } else {
      primaryButtonText = i18n('icu:GroupV1--Migration--migrate');
      onClickPrimaryButton = onMigrate;
      secondaryButtonProps = {
        secondaryButtonText: i18n('icu:cancel'),
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
          {i18n('icu:GroupV1--Migration--info--summary')}
        </GroupDialog.Paragraph>
        <GroupDialog.Paragraph>{keepHistory}</GroupDialog.Paragraph>
        {areWeInvited ? (
          <GroupDialog.Paragraph>
            {i18n('icu:GroupV1--Migration--info--invited--you')}
          </GroupDialog.Paragraph>
        ) : (
          <>
            {renderMembers({
              getPreferredBadge,
              i18n,
              members: invitedMembers,
              hasMigrated,
              kind: 'invited',
              theme,
            })}
            {renderMembers({
              getPreferredBadge,
              i18n,
              members: droppedMembers,
              hasMigrated,
              kind: 'dropped',
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
  hasMigrated,
  kind,
  theme,
}: Readonly<{
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  members: Array<ConversationType>;
  hasMigrated: boolean;
  kind: 'invited' | 'dropped';
  theme: ThemeType;
}>): React.ReactNode {
  if (!members.length) {
    return null;
  }

  let text: string;
  switch (kind) {
    case 'invited':
      text =
        members.length === 1
          ? i18n('icu:GroupV1--Migration--info--invited--one')
          : i18n('icu:GroupV1--Migration--info--invited--many');
      break;
    case 'dropped':
      if (hasMigrated) {
        text =
          members.length === 1
            ? i18n('icu:GroupV1--Migration--info--removed--before--one')
            : i18n('icu:GroupV1--Migration--info--removed--before--many');
      } else {
        text =
          members.length === 1
            ? i18n('icu:GroupV1--Migration--info--removed--after--one')
            : i18n('icu:GroupV1--Migration--info--removed--after--many');
      }
      break;
    default:
      throw missingCaseError(kind);
  }

  return (
    <>
      <GroupDialog.Paragraph>{text}</GroupDialog.Paragraph>
      <GroupDialog.Contacts
        contacts={sortByTitle(members)}
        getPreferredBadge={getPreferredBadge}
        i18n={i18n}
        theme={theme}
      />
    </>
  );
}

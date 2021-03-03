// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { LocalizerType } from '../../types/Util';
import { ConversationType } from '../../state/ducks/conversations';
import { Intl } from '../Intl';
import { ContactName } from './ContactName';
import { GroupV1MigrationDialog } from '../GroupV1MigrationDialog';

export type PropsDataType = {
  areWeInvited: boolean;
  droppedMembers: Array<ConversationType>;
  invitedMembers: Array<ConversationType>;
};

export type PropsHousekeepingType = {
  i18n: LocalizerType;
};

export type PropsType = PropsDataType & PropsHousekeepingType;

export function GroupV1Migration(props: PropsType): React.ReactElement {
  const { areWeInvited, droppedMembers, i18n, invitedMembers } = props;
  const [showingDialog, setShowingDialog] = React.useState(false);

  const showDialog = React.useCallback(() => {
    setShowingDialog(true);
  }, [setShowingDialog]);

  const dismissDialog = React.useCallback(() => {
    setShowingDialog(false);
  }, [setShowingDialog]);

  return (
    <div className="module-group-v1-migration">
      <div className="module-group-v1-migration--icon" />
      <div className="module-group-v1-migration--text">
        {i18n('GroupV1--Migration--was-upgraded')}
      </div>
      {areWeInvited ? (
        <div className="module-group-v1-migration--text">
          {i18n('GroupV1--Migration--invited--you')}
        </div>
      ) : (
        <>
          {renderUsers(invitedMembers, i18n, 'GroupV1--Migration--invited')}
          {renderUsers(droppedMembers, i18n, 'GroupV1--Migration--removed')}
        </>
      )}
      <button
        type="button"
        className="module-group-v1-migration--button"
        onClick={showDialog}
      >
        {i18n('GroupV1--Migration--learn-more')}
      </button>
      {showingDialog ? (
        <GroupV1MigrationDialog
          areWeInvited={areWeInvited}
          droppedMembers={droppedMembers}
          hasMigrated
          i18n={i18n}
          invitedMembers={invitedMembers}
          migrate={() =>
            window.log.warn('GroupV1Migration: Modal called migrate()')
          }
          onClose={dismissDialog}
        />
      ) : null}
    </div>
  );
}

function renderUsers(
  members: Array<ConversationType>,
  i18n: LocalizerType,
  keyPrefix: string
): React.ReactElement | null {
  if (!members || members.length === 0) {
    return null;
  }

  const className = 'module-group-v1-migration--text';

  if (members.length === 1) {
    return (
      <div className={className}>
        <Intl
          i18n={i18n}
          id={`${keyPrefix}--one`}
          components={[<ContactName title={members[0].title} i18n={i18n} />]}
        />
      </div>
    );
  }

  return (
    <div className={className}>
      {i18n(`${keyPrefix}--many`, [members.length.toString()])}
    </div>
  );
}

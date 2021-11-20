// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { Button, ButtonSize, ButtonVariant } from '../Button';
import { SystemMessage } from './SystemMessage';
import type { LocalizerType, ThemeType } from '../../types/Util';
import type { ConversationType } from '../../state/ducks/conversations';
import type { PreferredBadgeSelectorType } from '../../state/selectors/badges';
import { Intl } from '../Intl';
import { ContactName } from './ContactName';
import { GroupV1MigrationDialog } from '../GroupV1MigrationDialog';
import * as log from '../../logging/log';

export type PropsDataType = {
  areWeInvited: boolean;
  droppedMembers: Array<ConversationType>;
  invitedMembers: Array<ConversationType>;
};

export type PropsHousekeepingType = {
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  theme: ThemeType;
};

export type PropsType = PropsDataType & PropsHousekeepingType;

export function GroupV1Migration(props: PropsType): React.ReactElement {
  const {
    areWeInvited,
    droppedMembers,
    getPreferredBadge,
    i18n,
    invitedMembers,
    theme,
  } = props;
  const [showingDialog, setShowingDialog] = React.useState(false);

  const showDialog = React.useCallback(() => {
    setShowingDialog(true);
  }, [setShowingDialog]);

  const dismissDialog = React.useCallback(() => {
    setShowingDialog(false);
  }, [setShowingDialog]);

  return (
    <>
      <SystemMessage
        icon="group"
        contents={
          <>
            <p>{i18n('GroupV1--Migration--was-upgraded')}</p>
            <p>
              {areWeInvited ? (
                i18n('GroupV1--Migration--invited--you')
              ) : (
                <>
                  {renderUsers(
                    invitedMembers,
                    i18n,
                    'GroupV1--Migration--invited'
                  )}
                  {renderUsers(
                    droppedMembers,
                    i18n,
                    'GroupV1--Migration--removed'
                  )}
                </>
              )}
            </p>
          </>
        }
        button={
          <Button
            onClick={showDialog}
            size={ButtonSize.Small}
            variant={ButtonVariant.SystemMessage}
          >
            {i18n('GroupV1--Migration--learn-more')}
          </Button>
        }
      />
      {showingDialog ? (
        <GroupV1MigrationDialog
          areWeInvited={areWeInvited}
          droppedMembers={droppedMembers}
          getPreferredBadge={getPreferredBadge}
          hasMigrated
          i18n={i18n}
          invitedMembers={invitedMembers}
          migrate={() => log.warn('GroupV1Migration: Modal called migrate()')}
          onClose={dismissDialog}
          theme={theme}
        />
      ) : null}
    </>
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

  if (members.length === 1) {
    return (
      <p>
        <Intl
          i18n={i18n}
          id={`${keyPrefix}--one`}
          components={[<ContactName title={members[0].title} />]}
        />
      </p>
    );
  }

  return <p>{i18n(`${keyPrefix}--many`, [members.length.toString()])}</p>;
}

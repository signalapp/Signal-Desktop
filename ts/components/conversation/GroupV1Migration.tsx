// Copyright 2020 Signal Messenger, LLC
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
  conversationId: string;
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
    conversationId,
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
            <p>{i18n('icu:GroupV1--Migration--was-upgraded')}</p>
            <p>
              {areWeInvited ? (
                i18n('icu:GroupV1--Migration--invited--you')
              ) : (
                <>
                  {renderUsers(invitedMembers, i18n, 'invited')}
                  {renderUsers(droppedMembers, i18n, 'removed')}
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
            {i18n('icu:GroupV1--Migration--learn-more')}
          </Button>
        }
      />
      {showingDialog ? (
        <GroupV1MigrationDialog
          areWeInvited={areWeInvited}
          conversationId={conversationId}
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
  kind: 'invited' | 'removed'
): React.ReactElement | null {
  if (!members || members.length === 0) {
    return null;
  }

  if (members.length === 1) {
    const contact = <ContactName title={members[0].title} />;
    return (
      <p>
        {kind === 'invited' && (
          <Intl
            i18n={i18n}
            id="icu:GroupV1--Migration--invited--one"
            components={{ contact }}
          />
        )}
        {kind === 'removed' && (
          <Intl
            i18n={i18n}
            id="icu:GroupV1--Migration--removed--one"
            components={{ contact }}
          />
        )}
      </p>
    );
  }

  const count = members.length;

  return (
    <p>
      {kind === 'invited' && members.length > 1 && (
        <Intl
          i18n={i18n}
          id="icu:GroupV1--Migration--invited--many"
          components={{ count }}
        />
      )}
      {kind === 'removed' && members.length > 1 && (
        <Intl
          i18n={i18n}
          id="icu:GroupV1--Migration--removed--many"
          components={{ count }}
        />
      )}
    </p>
  );
}

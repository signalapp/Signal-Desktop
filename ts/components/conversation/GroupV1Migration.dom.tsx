// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { Button, ButtonSize, ButtonVariant } from '../Button.dom.js';
import { SystemMessage } from './SystemMessage.dom.js';
import type { LocalizerType, ThemeType } from '../../types/Util.std.js';
import type { ConversationType } from '../../state/ducks/conversations.preload.js';
import type { PreferredBadgeSelectorType } from '../../state/selectors/badges.preload.js';
import { I18n } from '../I18n.dom.js';
import { ContactName } from './ContactName.dom.js';
import { GroupV1MigrationDialog } from '../GroupV1MigrationDialog.dom.js';
import { createLogger } from '../../logging/log.std.js';

const log = createLogger('GroupV1Migration');

export type PropsDataType = {
  areWeInvited: boolean;
  conversationId: string;
  droppedMembers?: Array<ConversationType>;
  invitedMembers?: Array<ConversationType>;
  droppedMemberCount: number;
  invitedMemberCount: number;
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
    droppedMemberCount,
    getPreferredBadge,
    i18n,
    invitedMembers,
    invitedMemberCount,
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
              {' '}
              {areWeInvited ? (
                i18n('icu:GroupV1--Migration--invited--you')
              ) : (
                <>
                  {renderUsers({
                    members: invitedMembers,
                    count: invitedMemberCount,
                    i18n,
                    kind: 'invited',
                  })}
                  {renderUsers({
                    members: droppedMembers,
                    count: droppedMemberCount,
                    i18n,
                    kind: 'removed',
                  })}
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
          droppedMembers={droppedMembers}
          droppedMemberCount={droppedMemberCount}
          getPreferredBadge={getPreferredBadge}
          hasMigrated
          i18n={i18n}
          invitedMembers={invitedMembers}
          invitedMemberCount={invitedMemberCount}
          onMigrate={() => log.warn('Modal called migrate()')}
          onClose={dismissDialog}
          theme={theme}
        />
      ) : null}
    </>
  );
}

function renderUsers({
  members,
  count,
  i18n,
  kind,
}: {
  members?: Array<ConversationType>;
  count: number;
  i18n: LocalizerType;
  kind: 'invited' | 'removed';
}): React.ReactElement | null {
  if (count === 0) {
    return null;
  }

  if (members && count === 1) {
    const contact = <ContactName title={members[0].title} />;
    return (
      <p>
        {kind === 'invited' && (
          <I18n
            i18n={i18n}
            id="icu:GroupV1--Migration--invited--one"
            components={{ contact }}
          />
        )}
        {kind === 'removed' && (
          <I18n
            i18n={i18n}
            id="icu:GroupV1--Migration--removed--one"
            components={{ contact }}
          />
        )}
      </p>
    );
  }

  return (
    <p>
      {kind === 'invited' && (
        <I18n
          i18n={i18n}
          id="icu:GroupV1--Migration--invited--many"
          components={{ count }}
        />
      )}
      {kind === 'removed' && (
        <I18n
          i18n={i18n}
          id="icu:GroupV1--Migration--removed--many"
          components={{ count }}
        />
      )}
    </p>
  );
}

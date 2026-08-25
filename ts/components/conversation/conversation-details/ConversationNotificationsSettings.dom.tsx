// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo, useId, type JSX } from 'react';
import type { MuteExpiration } from '@signalapp/types';

import type { ConversationTypeType } from '../../../state/ducks/conversations.preload.ts';
import type { LocalizerType } from '../../../types/Util.std.ts';
import { PanelSection } from './PanelSection.dom.tsx';
import { PanelRow } from './PanelRow.dom.tsx';
import {
  ConversationDetailsIcon,
  IconType,
} from './ConversationDetailsIcon.dom.tsx';
import { Select } from '../../Select.dom.tsx';
import { isConversationMuted } from '../../../util/isConversationMuted.std.ts';
import { getMutedUntilText } from '../../../util/getMutedUntilText.std.ts';
import {
  getMuteExpiration,
  getMuteOptions,
  isMuteExpirationOption,
} from '../../../util/getMuteOptions.std.ts';
import { parseIntOrThrow } from '../../../util/parseIntOrThrow.std.ts';
import { strictAssert } from '../../../util/assert.std.ts';

export type PropsType = {
  id: string;
  conversationType: ConversationTypeType;
  dontNotifyForMentionsIfMuted: boolean;
  i18n: LocalizerType;
  muteExpiresAt: undefined | MuteExpiration;
  setDontNotifyForMentionsIfMuted: (
    conversationId: string,
    dontNotifyForMentionsIfMuted: boolean
  ) => unknown;
  setMuteExpiration: (
    conversationId: string,
    muteExpiresAt: undefined | MuteExpiration
  ) => unknown;
};

export function ConversationNotificationsSettings({
  id,
  conversationType,
  dontNotifyForMentionsIfMuted,
  i18n,
  muteExpiresAt,
  setMuteExpiration,
  setDontNotifyForMentionsIfMuted,
}: PropsType): JSX.Element {
  const muteNotificationsSelectId = useId();
  const mentionsSelectId = useId();

  const selectableMuteOptions = useMemo(
    () => getMuteOptions(muteExpiresAt, i18n).filter(isMuteExpirationOption),
    [i18n, muteExpiresAt]
  );

  const muteOptions = useMemo(
    () => [
      {
        disabled: true,
        text:
          muteExpiresAt != null && isConversationMuted({ muteExpiresAt })
            ? getMutedUntilText(muteExpiresAt, i18n)
            : i18n('icu:notMuted'),
        value: -1,
      },
      ...selectableMuteOptions.map(({ disabled, name }, index) => ({
        disabled,
        text: name,
        value: index,
      })),
    ],
    [i18n, muteExpiresAt, selectableMuteOptions]
  );

  const onMuteChange = (rawValue: string) => {
    const index = parseIntOrThrow(
      rawValue,
      'NotificationSettings: mute option index was not an integer'
    );
    const option = selectableMuteOptions[index];
    strictAssert(
      option != null,
      `NotificationSettings: no mute option at index ${index}`
    );
    setMuteExpiration(id, getMuteExpiration(option.value));
  };

  const onChangeDontNotifyForMentionsIfMuted = (rawValue: string) => {
    setDontNotifyForMentionsIfMuted(id, rawValue === 'yes');
  };

  return (
    <div className="conversation-details-panel">
      <PanelSection>
        <PanelRow
          icon={
            <ConversationDetailsIcon
              ariaLabel={i18n('icu:muteNotificationsTitle')}
              icon={IconType.mute}
            />
          }
          label={
            <label htmlFor={muteNotificationsSelectId}>
              {i18n('icu:muteNotificationsTitle')}
            </label>
          }
          right={
            <Select
              id={muteNotificationsSelectId}
              options={muteOptions}
              onChange={onMuteChange}
              value={-1}
            />
          }
        />
        {conversationType === 'group' && (
          <PanelRow
            icon={
              <ConversationDetailsIcon
                ariaLabel={i18n(
                  'icu:ConversationNotificationsSettings__mentions__label'
                )}
                icon={IconType.mention}
              />
            }
            label={
              <label htmlFor={mentionsSelectId}>
                {i18n('icu:ConversationNotificationsSettings__mentions__label')}
              </label>
            }
            info={i18n('icu:ConversationNotificationsSettings__mentions__info')}
            right={
              <Select
                id={mentionsSelectId}
                options={[
                  {
                    text: i18n(
                      'icu:ConversationNotificationsSettings__mentions__select__always-notify'
                    ),
                    value: 'no',
                  },
                  {
                    text: i18n(
                      'icu:ConversationNotificationsSettings__mentions__select__dont-notify-for-mentions-if-muted'
                    ),
                    value: 'yes',
                  },
                ]}
                onChange={onChangeDontNotifyForMentionsIfMuted}
                value={dontNotifyForMentionsIfMuted ? 'yes' : 'no'}
              />
            }
          />
        )}
      </PanelSection>
    </div>
  );
}

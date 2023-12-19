// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useMemo } from 'react';

import type { ConversationTypeType } from '../../../state/ducks/conversations';
import type { LocalizerType } from '../../../types/Util';
import { PanelSection } from './PanelSection';
import { PanelRow } from './PanelRow';
import { ConversationDetailsIcon, IconType } from './ConversationDetailsIcon';
import { Select } from '../../Select';
import { isConversationMuted } from '../../../util/isConversationMuted';
import { getMuteOptions } from '../../../util/getMuteOptions';
import { parseIntOrThrow } from '../../../util/parseIntOrThrow';
import { useUniqueId } from '../../../hooks/useUniqueId';

export type PropsType = {
  id: string;
  conversationType: ConversationTypeType;
  dontNotifyForMentionsIfMuted: boolean;
  i18n: LocalizerType;
  muteExpiresAt: undefined | number;
  setDontNotifyForMentionsIfMuted: (
    conversationId: string,
    dontNotifyForMentionsIfMuted: boolean
  ) => unknown;
  setMuteExpiration: (
    conversationId: string,
    muteExpiresAt: undefined | number
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
  const muteNotificationsSelectId = useUniqueId();
  const mentionsSelectId = useUniqueId();
  const muteOptions = useMemo(
    () => [
      ...(isConversationMuted({ muteExpiresAt })
        ? []
        : [
            {
              disabled: true,
              text: i18n('icu:notMuted'),
              value: -1,
            },
          ]),
      ...getMuteOptions(muteExpiresAt, i18n).map(
        ({ disabled, name, value }) => ({
          disabled,
          text: name,
          value,
        })
      ),
    ],
    [i18n, muteExpiresAt]
  );

  const onMuteChange = (rawValue: string) => {
    const ms = parseIntOrThrow(
      rawValue,
      'NotificationSettings: mute ms was not an integer'
    );
    setMuteExpiration(id, ms);
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

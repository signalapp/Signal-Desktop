// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useId, useMemo, type JSX } from 'react';
import { MuteExpiration } from '@signalapp/types';

import type { LocalizerType } from '../../../types/Util.std.ts';
import { AxoItem } from '../../../axo/items/AxoItem.dom.tsx';
import { AxoList } from '../../../axo/items/AxoList.dom.tsx';
import { MuteNotificationsDropdownMenu } from '../../MuteNotificationsMenu.dom.tsx';
import { isConversationMuted } from '../../../util/isConversationMuted.std.ts';
import { getMutedUntilText } from '../../../util/getMutedUntilText.std.ts';
import { getConversationMuteMenu } from '../../../util/getMuteOptions.std.ts';
import type { NotifyWhileMuted } from '../../../util/notifyWhileMuted.std.ts';
import { getNotifyWhileMutedSummary } from '../../../util/notifyWhileMuted.std.ts';
import { AxoContainer } from '../../../axo/AxoContainer.dom.tsx';

export type PropsType = {
  id: string;
  i18n: LocalizerType;
  isGroup: boolean;
  muteExpiresAt: undefined | MuteExpiration;
  notifyWhileMuted: NotifyWhileMuted;
  onOpenWhileMutedSettings: () => unknown;
  setMuteExpiration: (
    conversationId: string,
    muteExpiresAt: undefined | MuteExpiration
  ) => unknown;
};

export function ConversationNotificationsSettings({
  id,
  i18n,
  isGroup,
  muteExpiresAt,
  notifyWhileMuted,
  onOpenWhileMutedSettings,
  setMuteExpiration,
}: PropsType): JSX.Element {
  const whileMutedLabelId = useId();

  const mutedUntilText =
    muteExpiresAt != null && isConversationMuted({ muteExpiresAt })
      ? getMutedUntilText(muteExpiresAt, i18n)
      : null;

  const whileMutedSummary = useMemo(() => {
    // Mentions and replies only apply to groups, and the "While muted" panel
    // hides those rows for 1:1 chats, so don't summarize them here either.
    const summarized = isGroup
      ? notifyWhileMuted
      : { ...notifyWhileMuted, mentions: false, replies: false };

    return getNotifyWhileMutedSummary(summarized, i18n);
  }, [i18n, isGroup, notifyWhileMuted]);

  const muteMenu = useMemo(
    () => getConversationMuteMenu(muteExpiresAt, i18n),
    [i18n, muteExpiresAt]
  );

  const handleMuteExpiration = useCallback(
    (expiration: MuteExpiration) => {
      setMuteExpiration(id, expiration);
    },
    [id, setMuteExpiration]
  );

  const handleUnmute = useCallback(() => {
    setMuteExpiration(id, MuteExpiration.UNMUTED);
  }, [id, setMuteExpiration]);

  return (
    <AxoContainer.Root>
      <AxoList.Group>
        <AxoList.Root
          accessibilityLabel={i18n('icu:ConversationDetails--notifications')}
        >
          <AxoList.Body>
            <AxoItem.Group>
              <AxoItem.Root>
                <AxoItem.Leading>
                  <AxoItem.Icon symbol="bell-slash" />
                </AxoItem.Leading>
                <AxoItem.Content>
                  <AxoItem.Body>
                    <AxoItem.Label>
                      {i18n('icu:muteNotificationsTitle')}
                    </AxoItem.Label>
                    <AxoItem.Description>
                      {mutedUntilText ?? i18n('icu:notMuted')}
                    </AxoItem.Description>
                  </AxoItem.Body>
                  <AxoItem.Accessory>
                    {mutedUntilText != null ? (
                      <AxoItem.Action
                        variant="subtle-secondary"
                        onClick={handleUnmute}
                      >
                        {i18n('icu:unmute')}
                      </AxoItem.Action>
                    ) : (
                      <MuteNotificationsDropdownMenu
                        i18n={i18n}
                        label={muteMenu.label}
                        options={muteMenu.options}
                        onMuteExpiration={handleMuteExpiration}
                      >
                        <AxoItem.Action variant="subtle-secondary">
                          {i18n('icu:mute')}
                        </AxoItem.Action>
                      </MuteNotificationsDropdownMenu>
                    )}
                  </AxoItem.Accessory>
                </AxoItem.Content>
              </AxoItem.Root>
              <AxoItem.Root>
                <AxoItem.Leading>
                  <AxoItem.Icon symbol="bell-badge" />
                </AxoItem.Leading>
                <AxoItem.Content>
                  <AxoItem.Body>
                    <AxoItem.Label id={whileMutedLabelId}>
                      {i18n('icu:WhileMuted__title')}
                    </AxoItem.Label>
                    <AxoItem.Value>{whileMutedSummary}</AxoItem.Value>
                    <AxoItem.Description>
                      {i18n('icu:WhileMuted__description')}
                    </AxoItem.Description>
                    <AxoItem.HiddenTrigger
                      labelledby={whileMutedLabelId}
                      onClick={onOpenWhileMutedSettings}
                    />
                  </AxoItem.Body>
                  <AxoItem.Trailing>
                    <AxoItem.Arrow />
                  </AxoItem.Trailing>
                </AxoItem.Content>
              </AxoItem.Root>
            </AxoItem.Group>
          </AxoList.Body>
        </AxoList.Root>
      </AxoList.Group>
    </AxoContainer.Root>
  );
}

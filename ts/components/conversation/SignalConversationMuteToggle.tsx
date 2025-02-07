// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { LocalizerType } from '../../types/I18N';

type Props = {
  isMuted: boolean;
  i18n: LocalizerType;
  setMuteExpiration: (conversationId: string, muteExpiresAt: number) => unknown;
  conversationId: string;
};
export function SignalConversationMuteToggle({
  isMuted,
  i18n,
  setMuteExpiration,
  conversationId,
}: Props): JSX.Element {
  const onMuteToggleClicked = () => {
    setMuteExpiration(conversationId, isMuted ? 0 : Number.MAX_SAFE_INTEGER);
  };

  return (
    <div className="SignalConversationMuteToggle">
      <button
        onClick={onMuteToggleClicked}
        type="button"
        className="SignalConversationMuteToggle__text"
      >
        {isMuted ? i18n('icu:unmute') : i18n('icu:mute')}
      </button>
    </div>
  );
}

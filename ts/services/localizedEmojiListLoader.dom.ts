// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { Emoji } from '../axo/emoji.std.ts';
import { drop } from '../util/drop.std.ts';

export async function loadLocalizedEmojiList(): Promise<void> {
  const locale = window.SignalContext.i18n.getLocale();

  // Don't block app startup on network fetch
  drop(
    (async () => {
      const localizedEmojiList =
        await window.SignalContext.getLocalizedEmojiList(locale);
      Emoji.setupLocale(localizedEmojiList);
    })()
  );
}

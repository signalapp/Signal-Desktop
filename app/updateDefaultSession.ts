// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Session } from 'electron';

const SPELL_CHECKER_DICTIONARY_DOWNLOAD_URL = `https://updates.signal.org/desktop/hunspell_dictionaries/${process.versions.electron}/`;

export function updateDefaultSession(session: Session): void {
  session.setSpellCheckerDictionaryDownloadURL(
    SPELL_CHECKER_DICTIONARY_DOWNLOAD_URL
  );
}

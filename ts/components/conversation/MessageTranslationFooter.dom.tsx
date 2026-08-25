// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';
import classNames from 'classnames';
import type { LocalizerType } from '../../types/I18N.std.ts';
import type { MessageTranslationEntryType } from '../../state/ducks/messageTranslation.preload.ts';

export type PropsType = Readonly<{
  i18n: LocalizerType;
  direction: 'incoming' | 'outgoing';
  translation: MessageTranslationEntryType;
  showingOriginal: boolean;
  onToggleShowOriginal: () => void;
  onRetry: () => void;
}>;

function getLanguageDisplayName(i18n: LocalizerType, tag: string): string {
  try {
    return (
      new Intl.DisplayNames([i18n.getLocale()], { type: 'language' }).of(
        tag
      ) ?? tag
    );
  } catch {
    return tag;
  }
}

export function MessageTranslationFooter({
  i18n,
  direction,
  translation,
  showingOriginal,
  onToggleShowOriginal,
  onRetry,
}: PropsType): JSX.Element | null {
  const className = classNames(
    'module-message__translation-footer',
    `module-message__translation-footer--${direction}`
  );

  if (translation.status === 'pending') {
    return (
      <div className={className}>
        {i18n('icu:MessageTranslation__pending')}
      </div>
    );
  }

  if (translation.status === 'error') {
    // 'languageNotInstalled' is the single most common real failure — the
    // target language pack just isn't downloaded yet. Retrying without
    // installing it can never succeed, so point at the fix instead of
    // offering a dead-end retry.
    if (translation.errorCode === 'languageNotInstalled') {
      return (
        <div className={className}>
          {i18n('icu:MessageTranslation__language-not-installed')}
        </div>
      );
    }

    return (
      <div className={className}>
        {i18n('icu:MessageTranslation__error')}
        {' · '}
        <button
          type="button"
          className="module-message__translation-footer__link"
          onClick={onRetry}
        >
          {i18n('icu:MessageTranslation__retry')}
        </button>
      </div>
    );
  }

  const sourceLanguageName = translation.sourceLanguage
    ? getLanguageDisplayName(i18n, translation.sourceLanguage)
    : undefined;

  return (
    <div className={className}>
      {!showingOriginal && sourceLanguageName != null
        ? i18n('icu:MessageTranslation__translated-from', {
            language: sourceLanguageName,
          })
        : null}
      {!showingOriginal && sourceLanguageName != null ? ' · ' : null}
      <button
        type="button"
        className="module-message__translation-footer__link"
        onClick={onToggleShowOriginal}
      >
        {showingOriginal
          ? i18n('icu:MessageTranslation__show-translation')
          : i18n('icu:MessageTranslation__see-original')}
      </button>
    </div>
  );
}

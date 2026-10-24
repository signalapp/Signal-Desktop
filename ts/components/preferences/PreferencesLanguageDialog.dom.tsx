// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import * as LocaleMatcher from '@formatjs/intl-localematcher';
import lodash from 'lodash';
import AVAILABLE_LOCALES from '../../../build/available-locales.json' with { type: 'json' };
import type { LocalizerType } from '../../types/I18N.std.ts';
import { AxoDialog } from '../../axo/AxoDialog.dom.tsx';
import { AxoConfirmDialog } from '../../axo/AxoConfirmDialog.dom.tsx';
import { AxoSearchField } from '../../axo/fields/AxoSearchField.dom.tsx';
import { AxoList } from '../../axo/items/AxoList.dom.tsx';
import { AxoRadioGroupList } from '../../axo/items/AxoRadioGroupList.dom.tsx';
import { tw } from '../../axo/tw.dom.tsx';
import { removeDiacritics } from '../../util/removeDiacritics.std.ts';
import { getLocaleDisplayName } from '../../util/getLocaleDisplayName.std.ts';

const { partition } = lodash;

// Radio values must be strings, so the system language (`null`) needs one
const SYSTEM_LANGUAGE_VALUE = 'system';

type LocaleOption = Readonly<{
  /** `null` is the system language */
  locale: string | null;
  currentLocaleLabel: string;
  matchingLocaleLabel: string;
}>;

export type PreferencesLanguageDialogProps = Readonly<{
  i18n: LocalizerType;
  resolvedLocale: string;
  preferredSystemLocales: ReadonlyArray<string>;
  localeOverride: string | null;
  onLocaleChange: (locale: string | null) => void;
  onClose: () => void;
}>;

type Step = 'selection' | 'confirmation';

export function PreferencesLanguageDialog(
  props: PreferencesLanguageDialogProps
): ReactNode {
  const {
    i18n,
    resolvedLocale,
    preferredSystemLocales,
    localeOverride,
    onLocaleChange,
    onClose,
  } = props;

  const [step, setStep] = useState<Step>('selection');
  const [selectedLocale, setSelectedLocale] = useState(localeOverride);
  const [searchInput, setSearchInput] = useState('');

  const systemLocale = useMemo(() => {
    return LocaleMatcher.match(
      preferredSystemLocales as Array<string>, // bad types
      AVAILABLE_LOCALES,
      'en',
      { algorithm: 'best fit' }
    );
  }, [preferredSystemLocales]);

  const localeOptions = useMemo((): ReadonlyArray<LocaleOption> => {
    const collator = new Intl.Collator('en', { usage: 'sort' });

    const availableLocalesOptions = AVAILABLE_LOCALES.map(locale => {
      const currentLocaleLabel = getLocaleDisplayName(resolvedLocale, locale);
      const matchingLocaleLabel = getLocaleDisplayName(locale, locale);
      return { locale, currentLocaleLabel, matchingLocaleLabel };
    }).sort((a, b) => {
      return collator.compare(a.locale, b.locale);
    });

    const [localeOverrideMatches, localeOverrideNonMatches] = partition(
      availableLocalesOptions,
      option => {
        return option.locale === localeOverride;
      }
    );

    return [
      ...localeOverrideMatches,
      {
        locale: null,
        currentLocaleLabel: i18n('icu:Preferences__Language__SystemLanguage'),
        matchingLocaleLabel: getLocaleDisplayName(systemLocale, systemLocale),
      },
      ...localeOverrideNonMatches,
    ];
  }, [i18n, resolvedLocale, localeOverride, systemLocale]);

  const searchResults = useMemo(() => {
    const input = removeDiacritics(searchInput.trim().toLowerCase());

    if (input === '') {
      return localeOptions;
    }

    function isMatch(value: string) {
      return removeDiacritics(value.toLowerCase()).includes(input);
    }

    return localeOptions.filter(option => {
      return (
        isMatch(option.currentLocaleLabel) ||
        isMatch(option.matchingLocaleLabel)
      );
    });
  }, [localeOptions, searchInput]);

  const handleOpenChange = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleValueChange = useCallback((value: string) => {
    setSelectedLocale(value === SYSTEM_LANGUAGE_VALUE ? null : value);
  }, []);

  const handleConfirm = useCallback(() => {
    onLocaleChange(selectedLocale);
    onClose();
  }, [onLocaleChange, onClose, selectedLocale]);

  // Don't allow setting a language that has been hidden by the search
  const selectionVisible = searchResults.some(option => {
    return option.locale === selectedLocale;
  });

  if (step === 'confirmation') {
    return (
      <AxoConfirmDialog.Root
        open
        onCancel={() => setStep('selection')}
        title={i18n('icu:Preferences__LanguageModal__Restart__Title')}
        description={i18n(
          'icu:Preferences__LanguageModal__Restart__Description'
        )}
      >
        <AxoConfirmDialog.Cancel />
        <AxoConfirmDialog.Action
          variant="strong-primary"
          onClick={handleConfirm}
        >
          {i18n('icu:Preferences__LanguageModal__Restart__Button')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>
    );
  }

  return (
    <AxoDialog.Root open onOpenChange={handleOpenChange}>
      <AxoDialog.Content
        size="sm"
        escape="cancel-is-noop"
        disableMissingAriaDescriptionWarning
      >
        <AxoDialog.Header>
          <AxoDialog.Title>
            {i18n('icu:Preferences__Language__ModalTitle')}
          </AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Search>
          <AxoSearchField.Root
            value={searchInput}
            onValueChange={setSearchInput}
          >
            <AxoSearchField.Icon />
            <AxoSearchField.Input
              autoFocus
              placeholder={i18n('icu:Preferences__Language__SearchLanguages')}
            />
            <AxoSearchField.Clear />
          </AxoSearchField.Root>
        </AxoDialog.Search>
        <AxoDialog.Body padding="md" forceMaxHeight>
          {searchResults.length === 0 && (
            <p className={tw('p-4 text-center type-body-large text-primary')}>
              {i18n('icu:Preferences__Language__NoResults', {
                searchTerm: searchInput.trim(),
              })}
            </p>
          )}
          {searchResults.length !== 0 && (
            <AxoList.Group>
              <AxoRadioGroupList.Root
                value={selectedLocale ?? SYSTEM_LANGUAGE_VALUE}
                onValueChange={handleValueChange}
              >
                {searchResults.map(option => {
                  const value = option.locale ?? SYSTEM_LANGUAGE_VALUE;
                  return (
                    <AxoRadioGroupList.Item key={value} value={value}>
                      <AxoRadioGroupList.Label>
                        {option.currentLocaleLabel}
                      </AxoRadioGroupList.Label>
                      <AxoRadioGroupList.Description>
                        <span
                          lang={option.locale ?? systemLocale}
                          className={tw('font-sans')}
                        >
                          {option.matchingLocaleLabel}
                        </span>
                      </AxoRadioGroupList.Description>
                    </AxoRadioGroupList.Item>
                  );
                })}
              </AxoRadioGroupList.Root>
            </AxoList.Group>
          )}
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action variant="subtle-secondary" onClick={onClose}>
              {i18n('icu:cancel')}
            </AxoDialog.Action>
            <AxoDialog.Action
              variant="strong-primary"
              disabled={selectedLocale === localeOverride || !selectionVisible}
              onClick={() => setStep('confirmation')}
            >
              {i18n('icu:Preferences__LanguageModal__Set')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

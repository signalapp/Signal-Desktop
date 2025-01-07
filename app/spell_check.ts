// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { BrowserWindow } from 'electron';
import { Menu, clipboard, nativeImage } from 'electron';
import * as LocaleMatcher from '@formatjs/intl-localematcher';

import { maybeParseUrl } from '../ts/util/url';

import type { MenuListType } from '../ts/types/menu';
import type { LocalizerType } from '../ts/types/Util';
import { strictAssert } from '../ts/util/assert';
import type { LoggerType } from '../ts/types/Logging';
import { handleAttachmentRequest } from './attachment_channel';

export const FAKE_DEFAULT_LOCALE = 'und'; // 'und' is the BCP 47 subtag for "undetermined"

strictAssert(
  new Intl.Locale(FAKE_DEFAULT_LOCALE).toString() === FAKE_DEFAULT_LOCALE,
  "Ensure Intl doesn't change our fake locale ever"
);

export function getLanguages(
  preferredSystemLocales: ReadonlyArray<string>,
  availableLocales: ReadonlyArray<string>,
  defaultLocale: string
): Array<string> {
  const matchedLocales = [];

  preferredSystemLocales.forEach(preferredSystemLocale => {
    const matchedLocale = LocaleMatcher.match(
      [preferredSystemLocale],
      availableLocales as Array<string>, // bad types
      // We don't want to fallback to the default locale right away in case we might
      // match some other locales first.
      //
      // However, we do want to match the default locale in case the user's locales
      // actually matches it.
      //
      // This fake locale allows us to reliably filter it out within the loop.
      FAKE_DEFAULT_LOCALE,
      { algorithm: 'best fit' }
    );
    if (matchedLocale !== FAKE_DEFAULT_LOCALE) {
      matchedLocales.push(matchedLocale);
    }
  });

  if (matchedLocales.length === 0) {
    matchedLocales.push(defaultLocale);
  }

  return matchedLocales;
}

export const setup = (
  browserWindow: BrowserWindow,
  preferredSystemLocales: ReadonlyArray<string>,
  localeOverride: string | null,
  i18n: LocalizerType,
  logger: LoggerType
): void => {
  const { session } = browserWindow.webContents;

  session.on('spellcheck-dictionary-download-begin', (_event, lang) => {
    logger.info('spellcheck: dictionary download begin:', lang);
  });
  session.on('spellcheck-dictionary-download-failure', (_event, lang) => {
    logger.error('spellcheck: dictionary download failure:', lang);
  });
  session.on('spellcheck-dictionary-download-success', (_event, lang) => {
    logger.info('spellcheck: dictionary download success:', lang);
  });
  session.on('spellcheck-dictionary-initialized', (_event, lang) => {
    logger.info('spellcheck: dictionary initialized:', lang);
  });

  // Locale override should be combined with other preferences rather than
  // replace them entirely.
  const combinedLocales =
    localeOverride != null
      ? [localeOverride, ...preferredSystemLocales]
      : preferredSystemLocales;

  const availableLocales = session.availableSpellCheckerLanguages;
  const languages = getLanguages(combinedLocales, availableLocales, 'en');
  console.log('spellcheck: user locales:', combinedLocales);
  console.log(
    'spellcheck: available spellchecker languages:',
    availableLocales
  );
  console.log('spellcheck: setting languages to:', languages);
  session.setSpellCheckerLanguages(languages);

  browserWindow.webContents.on('context-menu', (_event, params) => {
    const { editFlags } = params;
    const isMisspelled = Boolean(params.misspelledWord);
    const isLink = Boolean(params.linkURL);
    const isImage =
      params.mediaType === 'image' &&
      params.hasImageContents &&
      params.srcURL &&
      !params.selectionText.trim();

    const showMenu =
      params.isEditable || editFlags.canCopy || isLink || isImage;

    // Popup editor menu
    if (showMenu) {
      const template: MenuListType = [];

      if (isMisspelled) {
        if (params.dictionarySuggestions.length > 0) {
          template.push(
            ...params.dictionarySuggestions.map(label => ({
              label,
              click: () => {
                browserWindow.webContents.replaceMisspelling(label);
              },
            }))
          );
        } else {
          template.push({
            label: i18n('icu:contextMenuNoSuggestions'),
            enabled: false,
          });
        }
        template.push({ type: 'separator' });
      }

      if (params.isEditable) {
        if (editFlags.canUndo) {
          template.push({ label: i18n('icu:editMenuUndo'), role: 'undo' });
        }
        // This is only ever `true` if undo was triggered via the context menu
        // (not ctrl/cmd+z)
        if (editFlags.canRedo) {
          template.push({ label: i18n('icu:editMenuRedo'), role: 'redo' });
        }
        if (editFlags.canUndo || editFlags.canRedo) {
          template.push({ type: 'separator' });
        }
        if (editFlags.canCut) {
          template.push({ label: i18n('icu:editMenuCut'), role: 'cut' });
        }
      }

      if (editFlags.canCopy || isLink || isImage) {
        let click;
        let label;

        if (isLink) {
          click = () => {
            clipboard.writeText(params.linkURL);
          };
          label = i18n('icu:contextMenuCopyLink');
        } else if (isImage) {
          click = async () => {
            const parsedSrcUrl = maybeParseUrl(params.srcURL);
            if (!parsedSrcUrl || parsedSrcUrl.protocol !== 'attachment:') {
              return;
            }

            const urlIsViewOnce =
              parsedSrcUrl.searchParams.get('disposition') === 'temporary';
            if (urlIsViewOnce) {
              return;
            }

            const req = new Request(parsedSrcUrl, {
              method: 'GET',
            });

            try {
              const res = await handleAttachmentRequest(req);
              if (!res.ok) {
                return;
              }

              const image = nativeImage.createFromBuffer(
                Buffer.from(await res.arrayBuffer())
              );
              clipboard.writeImage(image);
            } catch (error) {
              logger.error('Failed to load image', error);
            }
          };
          label = i18n('icu:contextMenuCopyImage');
        } else {
          label = i18n('icu:editMenuCopy');
        }

        template.push({
          label,
          role: isLink || isImage ? undefined : 'copy',
          click,
        });
      }

      if (editFlags.canPaste && !isImage) {
        template.push({ label: i18n('icu:editMenuPaste'), role: 'paste' });
      }

      if (editFlags.canPaste && !isImage) {
        template.push({
          label: i18n('icu:editMenuPasteAndMatchStyle'),
          role: 'pasteAndMatchStyle',
        });
      }

      // Only enable select all in editors because select all in non-editors
      // results in all the UI being selected
      if (editFlags.canSelectAll && params.isEditable) {
        template.push({
          label: i18n('icu:editMenuSelectAll'),
          role: 'selectAll',
        });
      }

      const menu = Menu.buildFromTemplate(template);
      menu.popup({
        window: browserWindow,
      });
    }
  });
};

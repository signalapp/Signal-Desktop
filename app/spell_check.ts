// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable strict */

import type { BrowserWindow } from 'electron';
import { Menu, clipboard, nativeImage } from 'electron';
import { sync as osLocaleSync } from 'os-locale';
import { uniq } from 'lodash';
import { fileURLToPath } from 'url';

import { maybeParseUrl } from '../ts/util/url';
import type { LocaleMessagesType } from '../ts/types/I18N';

import type { MenuListType } from './menu';

export function getLanguages(
  userLocale: string,
  availableLocales: ReadonlyArray<string>
): Array<string> {
  const baseLocale = userLocale.split('-')[0];
  // Attempt to find the exact locale
  const candidateLocales = uniq([userLocale, baseLocale]).filter(l =>
    availableLocales.includes(l)
  );

  if (candidateLocales.length > 0) {
    return candidateLocales;
  }

  // If no languages were found then just return all locales that start with the
  // base
  return uniq(availableLocales.filter(l => l.startsWith(baseLocale)));
}

export const setup = (
  browserWindow: BrowserWindow,
  messages: LocaleMessagesType
): void => {
  const { session } = browserWindow.webContents;
  const userLocale = osLocaleSync().replace(/_/g, '-');
  const availableLocales = session.availableSpellCheckerLanguages;
  const languages = getLanguages(userLocale, availableLocales);
  console.log(`spellcheck: user locale: ${userLocale}`);
  console.log(
    'spellcheck: available spellchecker languages: ',
    availableLocales
  );
  console.log('spellcheck: setting languages to: ', languages);
  session.setSpellCheckerLanguages(languages);

  browserWindow.webContents.on('context-menu', (_event, params) => {
    const { editFlags } = params;
    const isMisspelled = Boolean(params.misspelledWord);
    const isLink = Boolean(params.linkURL);
    const isImage =
      params.mediaType === 'image' && params.hasImageContents && params.srcURL;
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
            label: messages.contextMenuNoSuggestions.message,
            enabled: false,
          });
        }
        template.push({ type: 'separator' });
      }

      if (params.isEditable) {
        if (editFlags.canUndo) {
          template.push({ label: messages.editMenuUndo.message, role: 'undo' });
        }
        // This is only ever `true` if undo was triggered via the context menu
        // (not ctrl/cmd+z)
        if (editFlags.canRedo) {
          template.push({ label: messages.editMenuRedo.message, role: 'redo' });
        }
        if (editFlags.canUndo || editFlags.canRedo) {
          template.push({ type: 'separator' });
        }
        if (editFlags.canCut) {
          template.push({ label: messages.editMenuCut.message, role: 'cut' });
        }
      }

      if (editFlags.canCopy || isLink || isImage) {
        let click;
        let label;

        if (isLink) {
          click = () => {
            clipboard.writeText(params.linkURL);
          };
          label = messages.contextMenuCopyLink.message;
        } else if (isImage) {
          click = () => {
            const parsedSrcUrl = maybeParseUrl(params.srcURL);
            if (!parsedSrcUrl || parsedSrcUrl.protocol !== 'file:') {
              return;
            }

            const image = nativeImage.createFromPath(
              fileURLToPath(params.srcURL)
            );
            clipboard.writeImage(image);
          };
          label = messages.contextMenuCopyImage.message;
        } else {
          label = messages.editMenuCopy.message;
        }

        template.push({
          label,
          role: isLink || isImage ? undefined : 'copy',
          click,
        });
      }

      if (editFlags.canPaste && !isImage) {
        template.push({ label: messages.editMenuPaste.message, role: 'paste' });
      }

      if (editFlags.canPaste && !isImage) {
        template.push({
          label: messages.editMenuPasteAndMatchStyle.message,
          role: 'pasteAndMatchStyle',
        });
      }

      // Only enable select all in editors because select all in non-editors
      // results in all the UI being selected
      if (editFlags.canSelectAll && params.isEditable) {
        template.push({
          label: messages.editMenuSelectAll.message,
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

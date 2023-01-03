// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { BrowserWindow } from 'electron';
import { Menu, clipboard, nativeImage } from 'electron';
import { uniq } from 'lodash';
import { fileURLToPath } from 'url';

import { maybeParseUrl } from '../ts/util/url';
import type { LocaleType } from './locale';

import type { MenuListType } from '../ts/types/menu';

export function getLanguages(
  userLocale: string,
  availableLocales: ReadonlyArray<string>
): Array<string> {
  // First attempt to find the exact locale
  const candidateLocales = uniq([userLocale, userLocale]).filter(l =>
    availableLocales.includes(l)
  );
  if (candidateLocales.length > 0) {
    return candidateLocales;
  }

  // If no languages were found then return all locales that start with the base
  const baseLocale = userLocale.split('-')[0];
  return uniq(availableLocales.filter(l => l.startsWith(baseLocale)));
}

export const setup = (
  browserWindow: BrowserWindow,
  { name: userLocale, i18n }: LocaleType
): void => {
  const { session } = browserWindow.webContents;
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
            label: i18n('contextMenuNoSuggestions'),
            enabled: false,
          });
        }
        template.push({ type: 'separator' });
      }

      if (params.isEditable) {
        if (editFlags.canUndo) {
          template.push({ label: i18n('editMenuUndo'), role: 'undo' });
        }
        // This is only ever `true` if undo was triggered via the context menu
        // (not ctrl/cmd+z)
        if (editFlags.canRedo) {
          template.push({ label: i18n('editMenuRedo'), role: 'redo' });
        }
        if (editFlags.canUndo || editFlags.canRedo) {
          template.push({ type: 'separator' });
        }
        if (editFlags.canCut) {
          template.push({ label: i18n('editMenuCut'), role: 'cut' });
        }
      }

      if (editFlags.canCopy || isLink || isImage) {
        let click;
        let label;

        if (isLink) {
          click = () => {
            clipboard.writeText(params.linkURL);
          };
          label = i18n('contextMenuCopyLink');
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
          label = i18n('contextMenuCopyImage');
        } else {
          label = i18n('editMenuCopy');
        }

        template.push({
          label,
          role: isLink || isImage ? undefined : 'copy',
          click,
        });
      }

      if (editFlags.canPaste && !isImage) {
        template.push({ label: i18n('editMenuPaste'), role: 'paste' });
      }

      if (editFlags.canPaste && !isImage) {
        template.push({
          label: i18n('editMenuPasteAndMatchStyle'),
          role: 'pasteAndMatchStyle',
        });
      }

      // Only enable select all in editors because select all in non-editors
      // results in all the UI being selected
      if (editFlags.canSelectAll && params.isEditable) {
        template.push({
          label: i18n('editMenuSelectAll'),
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

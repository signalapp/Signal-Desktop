/* eslint-disable strict */

const { Menu, clipboard } = require('electron');
const osLocale = require('os-locale');
const { uniq } = require('lodash');

function getLanguages(userLocale, availableLocales) {
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

exports.setup = (browserWindow, messages) => {
  const { session } = browserWindow.webContents;
  const userLocale = osLocale.sync().replace(/_/g, '-');
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
    const showMenu = params.isEditable || editFlags.canCopy || isLink;

    // Popup editor menu
    if (showMenu) {
      const template = [];

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

      if (editFlags.canCopy || isLink) {
        template.push({
          label: isLink
            ? messages.contextMenuCopyLink.message
            : messages.editMenuCopy.message,
          role: isLink ? undefined : 'copy',
          click: isLink
            ? () => {
                clipboard.writeText(params.linkURL);
              }
            : undefined,
        });
      }

      if (editFlags.canPaste) {
        template.push({ label: messages.editMenuPaste.message, role: 'paste' });
      }

      if (editFlags.canPaste) {
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
          role: 'selectall',
        });
      }

      const menu = Menu.buildFromTemplate(template);
      menu.popup(browserWindow);
    }
  });
};

exports.getLanguages = getLanguages;

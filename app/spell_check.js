/* global exports, require */
/* eslint-disable strict */

const { Menu } = require('electron');
const osLocale = require('os-locale');

exports.setup = (browserWindow, messages) => {
  const { session } = browserWindow.webContents;
  const userLocale = osLocale.sync().replace(/_/g, '-');
  const userLocales = [userLocale, userLocale.split('-')[0]];

  const available = session.availableSpellCheckerLanguages;
  const languages = userLocales.filter(l => available.includes(l));
  console.log(`spellcheck: user locale: ${userLocale}`);
  console.log('spellcheck: available spellchecker languages: ', available);
  console.log('spellcheck: setting languages to: ', languages);
  session.setSpellCheckerLanguages(languages);

  browserWindow.webContents.on('context-menu', (_event, params) => {
    const { editFlags } = params;
    const isMisspelled = Boolean(params.misspelledWord);
    const showMenu = params.isEditable || editFlags.canCopy;

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

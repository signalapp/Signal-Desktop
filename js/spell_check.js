/* global require, process, _ */

/* eslint-disable strict */

const electron = require('electron');

const Typo = require('typo-js');
const osLocale = require('os-locale');

const { remote, webFrame } = electron;

// `remote.require` since `Menu` is a main-process module.
const buildEditorContextMenu = remote.require('electron-editor-context-menu');

const EN_VARIANT = /^en/;

// Prevent the spellchecker from showing contractions as errors.
const ENGLISH_SKIP_WORDS = [
  'ain',
  'couldn',
  'didn',
  'doesn',
  'hadn',
  'hasn',
  'mightn',
  'mustn',
  'needn',
  'oughtn',
  'shan',
  'shouldn',
  'wasn',
  'weren',
  'wouldn',
];

function setupLinux(locale) {
  if (EN_VARIANT.test(locale)) {
    window.log.info('Detected English locale on Linux. Enabling spell check.');

    return new Typo(locale);
  }

  window.log.info(
    'Detected non-English locale on Linux. Disabling spell check.'
  );

  return null;
}

// We load locale this way and not via app.getLocale() because this call returns
//   'es_ES' and not just 'es.' And hunspell requires the fully-qualified locale.
const locale = osLocale.sync().replace('-', '_');

// The LANG environment variable is how node spellchecker finds its default language:
//   https://github.com/atom/node-spellchecker/blob/59d2d5eee5785c4b34e9669cd5d987181d17c098/lib/spellchecker.js#L29
if (!process.env.LANG) {
  process.env.LANG = locale;
}

let spellchecker = null;

if (process.platform === 'linux') {
  spellchecker = setupLinux(locale);
} else {
  spellchecker = new Typo(locale);
  // OSX and Windows 8+ have OS-level spellcheck APIs
  window.log.info(
    'Using OS-level spell check API with locale',
    process.env.LANG
  );
}

const simpleChecker = {
  spellCheck(words, callback) {
    const mispelled = words.filter(word => this.isMisspelled(word));
    callback(mispelled);
  },
  isMisspelled(word) {
    if (!spellchecker) {
      return false;
    }

    const misspelled = !spellchecker.check(word);

    // The idea is to make this as fast as possible. For the many, many calls which
    //   don't result in the red squiggly, we minimize the number of checks.
    if (!misspelled) {
      return false;
    }

    // Only if we think we've found an error do we check the locale and skip list.
    if (locale.match(EN_VARIANT) && _.contains(ENGLISH_SKIP_WORDS, word)) {
      return false;
    }

    return true;
  },
  getSuggestions(text) {
    if (!spellchecker) {
      return [];
    }

    return spellchecker.suggest(text);
  },
  add() {},
};

const dummyChecker = {
  spellCheck(words, callback) {
    callback([]);
  },
  isMisspelled() {
    return false;
  },
  getSuggestions() {
    return [];
  },
  add() {
    // nothing
  },
};

window.spellChecker = simpleChecker;
window.disableSpellCheck = () => {
  window.removeEventListener('contextmenu', spellCheckHandler);
  window.addEventListener('contextmenu', defaultContextMenuHandler);
  webFrame.setSpellCheckProvider('en-US', dummyChecker);
};

window.enableSpellCheck = () => {
  webFrame.setSpellCheckProvider('en-US', simpleChecker);
  window.addEventListener('contextmenu', spellCheckHandler);
  window.removeEventListener('contextmenu', defaultContextMenuHandler);
};

const defaultContextMenuHandler = e => {
  // Only show the context menu in text editors.
  if (!e.target.closest('textarea, input, [contenteditable="true"]')) {
    return;
  }

  const menu = buildEditorContextMenu({});

  // @see js/spell_check.js:177
  setTimeout(() => {
    menu.popup(remote.getCurrentWindow());
  }, 30);
};

const spellCheckHandler = e => {
  // Only show the context menu in text editors.
  if (!e.target.closest('textarea, input, [contenteditable="true"]')) {
    return;
  }

  const selectedText = window.getSelection().toString();
  const isMisspelled = selectedText && simpleChecker.isMisspelled(selectedText);
  const spellingSuggestions =
    isMisspelled && simpleChecker.getSuggestions(selectedText).slice(0, 5);
  const menu = buildEditorContextMenu({
    isMisspelled,
    spellingSuggestions,
  });

  // The 'contextmenu' event is emitted after 'selectionchange' has fired
  //   but possibly before the visible selection has changed. Try to wait
  //   to show the menu until after that, otherwise the visible selection
  //   will update after the menu dismisses and look weird.
  setTimeout(() => {
    menu.popup(remote.getCurrentWindow());
  }, 30);
};

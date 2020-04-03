/* global require, process, _ */

/* eslint-disable strict */

const electron = require('electron');

const osLocale = require('os-locale');
const os = require('os');
const semver = require('semver');
const spellchecker = require('spellchecker');

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
  if (process.env.HUNSPELL_DICTIONARIES || locale !== 'en_US') {
    // apt-get install hunspell-<locale> can be run for easy access
    //   to other dictionaries
    const location = process.env.HUNSPELL_DICTIONARIES || '/usr/share/hunspell';

    window.log.info(
      'Detected Linux. Setting up spell check with locale',
      locale,
      'and dictionary location',
      location
    );
    spellchecker.setDictionary(locale, location);
  } else {
    window.log.info(
      'Detected Linux. Using default en_US spell check dictionary'
    );
  }
}

function setupWin7AndEarlier(locale) {
  if (process.env.HUNSPELL_DICTIONARIES || locale !== 'en_US') {
    const location = process.env.HUNSPELL_DICTIONARIES;

    window.log.info(
      'Detected Windows 7 or below. Setting up spell-check with locale',
      locale,
      'and dictionary location',
      location
    );
    spellchecker.setDictionary(locale, location);
  } else {
    window.log.info(
      'Detected Windows 7 or below. Using default en_US spell check dictionary'
    );
  }
}

// We load locale this way and not via app.getLocale() because this call returns
//   'es_ES' and not just 'es.' And hunspell requires the fully-qualified locale.
const locale = osLocale.sync().replace('-', '_');

// The LANG environment variable is how node spellchecker finds its default language:
//   https://github.com/atom/node-spellchecker/blob/59d2d5eee5785c4b34e9669cd5d987181d17c098/lib/spellchecker.js#L29
if (!process.env.LANG) {
  process.env.LANG = locale;
}

if (process.platform === 'linux') {
  setupLinux(locale);
} else if (process.platform === 'windows' && semver.lt(os.release(), '8.0.0')) {
  setupWin7AndEarlier(locale);
} else {
  // OSX and Windows 8+ have OS-level spellcheck APIs
  window.log.info(
    'Using OS-level spell check API with locale',
    process.env.LANG
  );
}

const simpleChecker = {
  spellCheck(text) {
    return !this.isMisspelled(text);
  },
  isMisspelled(text) {
    const misspelled = spellchecker.isMisspelled(text);

    // The idea is to make this as fast as possible. For the many, many calls which
    //   don't result in the red squiggly, we minimize the number of checks.
    if (!misspelled) {
      return false;
    }

    // Only if we think we've found an error do we check the locale and skip list.
    if (locale.match(EN_VARIANT) && _.contains(ENGLISH_SKIP_WORDS, text)) {
      return false;
    }

    return true;
  },
  getSuggestions(text) {
    return spellchecker.getCorrectionsForMisspelling(text);
  },
  add(text) {
    spellchecker.add(text);
  },
};

const dummyChecker = {
  spellCheck() {
    return true;
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
  webFrame.setSpellCheckProvider('en-US', false, dummyChecker);
};

window.enableSpellCheck = () => {
  webFrame.setSpellCheckProvider(
    'en-US',
    // Not sure what this parameter (`autoCorrectWord`) does: https://github.com/atom/electron/issues/4371
    // The documentation for `webFrame.setSpellCheckProvider` passes `true` so we do too.
    true,
    simpleChecker
  );
  window.addEventListener('contextmenu', spellCheckHandler);
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

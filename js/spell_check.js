(function () {
  var electron = require('electron');
  var remote = electron.remote;
  var app = remote.app;
  var webFrame = electron.webFrame;
  var path = require('path');

  var osLocale = require('os-locale');
  var os = require('os');
  var semver = require('semver');
  var spellchecker = require('spellchecker');

  // `remote.require` since `Menu` is a main-process module.
  var buildEditorContextMenu = remote.require('electron-editor-context-menu');

  var EN_VARIANT = /^en/;

  // Prevent the spellchecker from showing contractions as errors.
  var ENGLISH_SKIP_WORDS = [
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
    'wouldn'
  ];

  function setupLinux(locale) {
    if (process.env.HUNSPELL_DICTIONARIES || locale !== 'en_US') {
      // apt-get install hunspell-<locale> can be run for easy access to other dictionaries
      var location = process.env.HUNSPELL_DICTIONARIES || '/usr/share/hunspell';

      console.log('Detected Linux. Setting up spell check with locale', locale, 'and dictionary location', location);
      spellchecker.setDictionary(locale, location);
    } else {
      console.log('Detected Linux. Using default en_US spell check dictionary');
    }
  }

  function setupWin7AndEarlier(locale) {
    if (process.env.HUNSPELL_DICTIONARIES || locale !== 'en_US') {
      var location = process.env.HUNSPELL_DICTIONARIES;

      console.log('Detected Windows 7 or below. Setting up spell-check with locale', locale, 'and dictionary location', location);
      spellchecker.setDictionary(locale, location);
    } else {
      console.log('Detected Windows 7 or below. Using default en_US spell check dictionary');
    }
  }

  // We load locale this way and not via app.getLocale() because this call returns
  //   'es_ES' and not just 'es.' And hunspell requires the fully-qualified locale.
  var locale = osLocale.sync().replace('-', '_');

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
    console.log('Using OS-level spell check API with locale', process.env.LANG);
  }

  var simpleChecker = window.spellChecker = {
    spellCheck: function(text) {
      return !this.isMisspelled(text);
    },
    isMisspelled: function(text) {
      var misspelled = spellchecker.isMisspelled(text);

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
    getSuggestions: function(text) {
      return spellchecker.getCorrectionsForMisspelling(text);
    },
    add: function(text) {
      spellchecker.add(text);
    }
  };

  webFrame.setSpellCheckProvider(
    'en-US',
    // Not sure what this parameter (`autoCorrectWord`) does: https://github.com/atom/electron/issues/4371
    // The documentation for `webFrame.setSpellCheckProvider` passes `true` so we do too.
    true,
    simpleChecker
  );

  window.addEventListener('contextmenu', function(e) {
    // Only show the context menu in text editors.
    if (!e.target.closest('textarea, input, [contenteditable="true"]')) {
      return;
    }

    var selectedText = window.getSelection().toString();
    var isMisspelled = selectedText && simpleChecker.isMisspelled(selectedText);
    var spellingSuggestions = isMisspelled && simpleChecker.getSuggestions(selectedText).slice(0, 5);
    var menu = buildEditorContextMenu({
      isMisspelled: isMisspelled,
      spellingSuggestions: spellingSuggestions,
    });

    // The 'contextmenu' event is emitted after 'selectionchange' has fired but possibly before the
    // visible selection has changed. Try to wait to show the menu until after that, otherwise the
    // visible selection will update after the menu dismisses and look weird.
    setTimeout(function() {
      menu.popup(remote.getCurrentWindow());
    }, 30);
  });
})();

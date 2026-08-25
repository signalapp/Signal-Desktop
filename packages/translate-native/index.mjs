import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);

// The compiled addon links against Apple's Translation framework (macOS 15+
// only for the popover; macOS 26+ only for headless batch translation) and
// is built with a matching minimum-OS load command. We don't know whether
// dyld tolerates dlopen()-ing that on an older host, so we never even
// attempt to load the binary below macOS 15 — checked here in plain JS,
// before the native require() below runs at all. The finer macOS 26 gate
// for batch translation is a separate, purely in-process check
// (isBatchAvailable()) once the module is already loaded.
function getMacOSMajorVersion() {
  try {
    const version = execFileSync('sw_vers', ['-productVersion'], {
      encoding: 'utf8',
    }).trim();
    return parseInt(version.split('.')[0], 10);
  } catch {
    return 0;
  }
}

const isSupported =
  process.platform === 'darwin' && getMacOSMajorVersion() >= 15;

class TranslateAddon extends EventEmitter {
  constructor() {
    super();
    if (!isSupported) {
      throw new Error(
        'This module requires macOS 15 (Sequoia) or later'
      );
    }
    const native = require('bindings')('translate_addon');
    this.addon = new native.TranslateAddon();
    this.addon.on('closed', () => {
      this.emit('closed');
    });
  }

  // --- Popover (selection-based, macOS 15+) ---

  isAvailable() {
    return this.addon.isAvailable();
  }

  showTranslation(text = '') {
    this.addon.showTranslation(text);
  }

  // --- Headless batch translation (inline per-message, macOS 26+) ---

  // False on macOS < 26 — callers must check this before requesting a
  // batch translation or a detection-based UI affordance at all.
  isBatchAvailable() {
    return this.addon.isBatchAvailable();
  }

  // Synchronous, local, no session/model needed. Returns "" per string that
  // couldn't be confidently identified.
  detectLanguages(texts) {
    return this.addon.detectLanguages(texts);
  }

  // Resolves to 'installed' | 'supported' | 'unsupported' | 'unsupportedOS'.
  checkAvailability(sourceLang, targetLang) {
    return this.addon.checkAvailability(sourceLang, targetLang);
  }

  // texts must already be grouped by a single detected source language —
  // the framework only translates within one source→target pair per call.
  // Resolves to translated strings in the same order as `texts`. Rejects
  // with an Error whose `.message` is a machine-checkable code (see
  // TranslateSession.swift for what's actually distinguishable) on failure.
  translateBatch(sourceLang, targetLang, texts) {
    return this.addon.translateBatch(sourceLang, targetLang, texts);
  }

  destroy() {
    this.addon.destroy();
  }
}

export default isSupported ? new TranslateAddon() : null;

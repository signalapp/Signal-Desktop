import type { EventEmitter } from 'node:events';

export type LanguageAvailabilityStatus =
  | 'installed'
  | 'supported'
  | 'unsupported'
  | 'unsupportedOS';

export interface TranslateNative extends EventEmitter {
  // Popover (selection-based, macOS 15+)
  isAvailable(): boolean;
  showTranslation(text: string): void;

  // Headless batch translation (inline per-message, macOS 26+)
  isBatchAvailable(): boolean;
  detectLanguages(texts: string[]): string[];
  checkAvailability(
    sourceLang: string,
    targetLang: string
  ): Promise<LanguageAvailabilityStatus>;
  translateBatch(
    sourceLang: string,
    targetLang: string,
    texts: string[]
  ): Promise<string[]>;

  destroy(): void;
  on(event: 'closed', listener: () => void): this;
}

declare const translateNative: TranslateNative | null;
export default translateNative;

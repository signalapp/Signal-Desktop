export interface RecoveryPhraseUtil {
  mn_encode(str: string, wordset_name: string): string;
  mn_decode(str: string, wordset_name: string): string;
  get_languages(): Array<string>;
  pubkey_to_secret_words(pubKey?: string): string;
}

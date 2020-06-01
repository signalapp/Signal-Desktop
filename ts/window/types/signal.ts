import { SecretSessionCipher } from './SecretSessionCipher';

interface Metadata {
  SecretSessionCipher: typeof SecretSessionCipher;
}

export interface SignalInterface {
  Metadata: Metadata;
}

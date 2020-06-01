import { SecretSessionCipher } from './metadata/SecretSessionCipher';

interface Metadata {
  SecretSessionCipher: typeof SecretSessionCipher;
}

export interface SignalInterface {
  Metadata: Metadata;
}

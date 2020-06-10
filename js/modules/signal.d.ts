import { SecretSessionCipherConstructor } from './metadata/SecretSessionCipher';

interface Metadata {
  SecretSessionCipher: SecretSessionCipherConstructor;
}

export interface SignalInterface {
  Metadata: Metadata;
}

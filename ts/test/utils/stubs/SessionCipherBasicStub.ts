import { CipherTextObject } from '../../../window/types/libsignal-protocol';

export class SessionCipherBasicStub {
  public storage: any;
  public address: any;
  constructor(storage: any, address: any) {
    this.storage = storage;
    this.address = address;
  }

  public async encrypt(buffer: ArrayBuffer | Uint8Array): Promise<CipherTextObject> {
    throw new Error('Should stub this out');
  }
}

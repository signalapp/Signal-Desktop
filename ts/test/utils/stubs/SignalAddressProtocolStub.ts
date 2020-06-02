import { SignalProtocolAddress } from '../../../window/types/libsignal-protocol';

export class SignalProtocolAddressStub extends SignalProtocolAddress {
  private readonly hexEncodedPublicKey: string;
  private readonly deviceId: number;
  constructor(hexEncodedPublicKey: string, deviceId: number) {
    super(hexEncodedPublicKey, deviceId);
    this.hexEncodedPublicKey = hexEncodedPublicKey;
    this.deviceId = deviceId;
  }

  // tslint:disable-next-line: function-name
  public static fromString(encodedAddress: string): SignalProtocolAddressStub {
    const values = encodedAddress.split('.');

    return new SignalProtocolAddressStub(values[0], Number(values[1]));
  }

  public getName(): string { return this.hexEncodedPublicKey; }
  public getDeviceId(): number { return this.deviceId; }

  public equals(other: SignalProtocolAddress): boolean {
    return other.getName() === this.hexEncodedPublicKey;
  }

  public toString(): string { return this.hexEncodedPublicKey; }
}

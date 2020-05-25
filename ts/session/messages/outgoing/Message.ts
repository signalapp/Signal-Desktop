export abstract class Message {
  public readonly timestamp: number;
  public identifier: string;


  constructor({ timestamp, identifier }: { timestamp: number; identifier: string }) {
    if (identifier.length === 0) {
      throw new Error('Cannot set empty identifier');
    }
    this.timestamp = timestamp;
    this.identifier = identifier;
  }

  public setIdentifier(identifier: string) {
    if (identifier.length === 0) {
      throw new Error('Cannot set empty identifier');
    }
    this.identifier = identifier;
  }
}

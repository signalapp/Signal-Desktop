import { v4 as uuid } from 'uuid';

export interface MessageParams {
  timestamp: number;
}

export abstract class Message {
  public readonly timestamp: number;
  public identifier: string;


  constructor({ timestamp }: MessageParams) {
    this.timestamp = timestamp;
    this.identifier = uuid();
  }

  public setIdentifier(identifier: string) {
    if (identifier.length === 0) {
      throw new Error('Cannot set empty identifier');
    }
    this.identifier = identifier;
  }
}

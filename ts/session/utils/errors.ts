import { Response } from 'node-fetch';

export class EmptySwarmError extends Error {
  public error: any;
  public pubkey: string;
  constructor(pubkey: string, message: string) {
    // 'Error' breaks prototype chain here
    super(message);
    this.pubkey = pubkey.split('.')[0];
    this.name = 'EmptySwarmError';

    // restore prototype chain
    const actualProto = new.target.prototype;

    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    }
    // Maintains proper stack trace, where our error was thrown (only available on V8)
    //   via https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this);
    }
  }
}

export class NotFoundError extends Error {
  public error: any;
  constructor(message: string, error: any) {
    // 'Error' breaks prototype chain here
    super(message);
    this.error = error;
    this.name = 'NotFoundError';

    // restore prototype chain
    const actualProto = new.target.prototype;

    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    }
    // Maintains proper stack trace, where our error was thrown (only available on V8)
    //   via https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this);
    }
  }
}

export class HTTPError extends Error {
  public response: Response;
  constructor(message: string, response: Response) {
    // 'Error' breaks prototype chain here
    super(`${response.status} Error: ${message}`);
    this.response = response;
    this.name = 'HTTPError';

    // restore prototype chain
    const actualProto = new.target.prototype;

    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    }
    // Maintains proper stack trace, where our error was thrown (only available on V8)
    //   via https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this);
    }
  }
}

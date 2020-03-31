// Captures the globals put in place by preload.js, background.js and others

declare global {
  interface Window {
    dcodeIO: DCodeIOType;
    getExpiration: () => string;
    getEnvironment: () => string;
    getSocketStatus: () => number;
    libsignal: LibSignalType;
    log: {
      info: LoggerType;
      warn: LoggerType;
      error: LoggerType;
    };
    storage: {
      put: (key: string, value: any) => void;
      remove: (key: string) => void;
      get: (key: string) => any;
    };
    textsecure: TextSecureType;

    ConversationController: ConversationControllerType;
    Whisper: WhisperType;
  }
}

export type ConversationControllerType = {
  prepareForSend: (
    id: string,
    options: Object
  ) => {
    wrap: (promise: Promise<any>) => Promise<void>;
    sendOptions: Object;
  };
};

export type DCodeIOType = {
  ByteBuffer: {
    wrap: (
      value: any,
      type?: string
    ) => {
      toString: (type: string) => string;
      toArrayBuffer: () => ArrayBuffer;
    };
  };
};

export type LibSignalType = {
  KeyHelper: {
    generateIdentityKeyPair: () => Promise<{
      privKey: ArrayBuffer;
      pubKey: ArrayBuffer;
    }>;
  };
  Curve: {
    async: {
      calculateAgreement: (
        publicKey: ArrayBuffer,
        privateKey: ArrayBuffer
      ) => Promise<ArrayBuffer>;
    };
  };
  HKDF: {
    deriveSecrets: (
      packKey: ArrayBuffer,
      salt: ArrayBuffer,
      info: ArrayBuffer
    ) => Promise<Array<ArrayBuffer>>;
  };
};

export type LoggerType = (...args: Array<any>) => void;

export type TextSecureType = {
  storage: {
    user: {
      getNumber: () => string;
    };
    get: (key: string) => any;
  };
  messaging: {
    sendStickerPackSync: (
      operations: Array<{
        packId: string;
        packKey: string;
        installed: boolean;
      }>,
      options: Object
    ) => Promise<void>;
  };
};

export type WhisperType = {
  events: {
    trigger: (name: string, param1: any, param2: any) => void;
  };
};

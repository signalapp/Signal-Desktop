type LoggerType = (...args: Array<any>) => void;

type TextSecureType = {
  storage: {
    user: {
      getNumber: () => string;
    };
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

type ConversationControllerType = {
  prepareForSend: (
    id: string,
    options: Object
  ) => {
    wrap: (promise: Promise<any>) => Promise<void>;
    sendOptions: Object;
  };
};

interface ShimmedWindow extends Window {
  log: {
    error: LoggerType;
    info: LoggerType;
  };
  textsecure: TextSecureType;
  ConversationController: ConversationControllerType;
}

export function sendStickerPackSync(
  packId: string,
  packKey: string,
  installed: boolean
) {
  const { ConversationController, textsecure, log } = window as ShimmedWindow;
  const ourNumber = textsecure.storage.user.getNumber();
  const { wrap, sendOptions } = ConversationController.prepareForSend(
    ourNumber,
    { syncMessage: true }
  );

  if (!textsecure.messaging) {
    log.error(
      'shim: Cannot call sendStickerPackSync, textsecure.messaging is falsey'
    );

    return;
  }

  wrap(
    textsecure.messaging.sendStickerPackSync(
      [
        {
          packId,
          packKey,
          installed,
        },
      ],
      sendOptions
    )
  ).catch(error => {
    log.error(
      'shim: Error calling sendStickerPackSync:',
      error && error.stack ? error.stack : error
    );
  });
}

import * as $protobuf from "protobufjs";
import Long = require("long");
/** Properties of a ProvisioningToken. */
export interface IProvisioningToken {

    /** ProvisioningToken token */
    token?: (string|null);
}

/** Represents a ProvisioningToken. */
export class ProvisioningToken implements IProvisioningToken {

    /**
     * Constructs a new ProvisioningToken.
     * @param [properties] Properties to set
     */
    constructor(properties?: IProvisioningToken);

    /** ProvisioningToken token. */
    public token?: (string|null);

    /** ProvisioningToken _token. */
    public _token?: "token";

    /**
     * Encodes the specified ProvisioningToken message. Does not implicitly {@link ProvisioningToken.verify|verify} messages.
     * @param message ProvisioningToken message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IProvisioningToken, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a ProvisioningToken message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ProvisioningToken
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): ProvisioningToken;
}

/** Properties of a ProvisioningEnvelope. */
export interface IProvisioningEnvelope {

    /** ProvisioningEnvelope publicKey */
    publicKey?: (Uint8Array|null);

    /** ProvisioningEnvelope ciphertext */
    ciphertext?: (Uint8Array|null);
}

/** Represents a ProvisioningEnvelope. */
export class ProvisioningEnvelope implements IProvisioningEnvelope {

    /**
     * Constructs a new ProvisioningEnvelope.
     * @param [properties] Properties to set
     */
    constructor(properties?: IProvisioningEnvelope);

    /** ProvisioningEnvelope publicKey. */
    public publicKey?: (Uint8Array|null);

    /** ProvisioningEnvelope ciphertext. */
    public ciphertext?: (Uint8Array|null);

    /** ProvisioningEnvelope _publicKey. */
    public _publicKey?: "publicKey";

    /** ProvisioningEnvelope _ciphertext. */
    public _ciphertext?: "ciphertext";

    /**
     * Encodes the specified ProvisioningEnvelope message. Does not implicitly {@link ProvisioningEnvelope.verify|verify} messages.
     * @param message ProvisioningEnvelope message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IProvisioningEnvelope, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a ProvisioningEnvelope message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ProvisioningEnvelope
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): ProvisioningEnvelope;
}

/** Properties of a ProvisioningMessage. */
export interface IProvisioningMessage {

    /** ProvisioningMessage username */
    username?: (string|null);

    /** ProvisioningMessage password */
    password?: (string|null);
}

/** Represents a ProvisioningMessage. */
export class ProvisioningMessage implements IProvisioningMessage {

    /**
     * Constructs a new ProvisioningMessage.
     * @param [properties] Properties to set
     */
    constructor(properties?: IProvisioningMessage);

    /** ProvisioningMessage username. */
    public username?: (string|null);

    /** ProvisioningMessage password. */
    public password?: (string|null);

    /** ProvisioningMessage _username. */
    public _username?: "username";

    /** ProvisioningMessage _password. */
    public _password?: "password";

    /**
     * Encodes the specified ProvisioningMessage message. Does not implicitly {@link ProvisioningMessage.verify|verify} messages.
     * @param message ProvisioningMessage message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IProvisioningMessage, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a ProvisioningMessage message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ProvisioningMessage
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): ProvisioningMessage;
}

/** Properties of a StickerPack. */
export interface IStickerPack {

    /** StickerPack title */
    title?: (string|null);

    /** StickerPack author */
    author?: (string|null);

    /** StickerPack cover */
    cover?: (StickerPack.ISticker|null);

    /** StickerPack stickers */
    stickers?: (StickerPack.ISticker[]|null);
}

/** Represents a StickerPack. */
export class StickerPack implements IStickerPack {

    /**
     * Constructs a new StickerPack.
     * @param [properties] Properties to set
     */
    constructor(properties?: IStickerPack);

    /** StickerPack title. */
    public title?: (string|null);

    /** StickerPack author. */
    public author?: (string|null);

    /** StickerPack cover. */
    public cover?: (StickerPack.ISticker|null);

    /** StickerPack stickers. */
    public stickers: StickerPack.ISticker[];

    /** StickerPack _title. */
    public _title?: "title";

    /** StickerPack _author. */
    public _author?: "author";

    /** StickerPack _cover. */
    public _cover?: "cover";

    /**
     * Encodes the specified StickerPack message. Does not implicitly {@link StickerPack.verify|verify} messages.
     * @param message StickerPack message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IStickerPack, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a StickerPack message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns StickerPack
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): StickerPack;
}

export namespace StickerPack {

    /** Properties of a Sticker. */
    interface ISticker {

        /** Sticker id */
        id?: (number|null);

        /** Sticker emoji */
        emoji?: (string|null);
    }

    /** Represents a Sticker. */
    class Sticker implements ISticker {

        /**
         * Constructs a new Sticker.
         * @param [properties] Properties to set
         */
        constructor(properties?: StickerPack.ISticker);

        /** Sticker id. */
        public id?: (number|null);

        /** Sticker emoji. */
        public emoji?: (string|null);

        /** Sticker _id. */
        public _id?: "id";

        /** Sticker _emoji. */
        public _emoji?: "emoji";

        /**
         * Encodes the specified Sticker message. Does not implicitly {@link StickerPack.Sticker.verify|verify} messages.
         * @param message Sticker message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: StickerPack.ISticker, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Sticker message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Sticker
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): StickerPack.Sticker;
    }
}

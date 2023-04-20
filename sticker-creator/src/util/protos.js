/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
import * as $protobuf from "protobufjs/minimal";

// Common aliases
const $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
const $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

export const ProvisioningToken = $root.ProvisioningToken = (() => {

    /**
     * Properties of a ProvisioningToken.
     * @exports IProvisioningToken
     * @interface IProvisioningToken
     * @property {string|null} [token] ProvisioningToken token
     */

    /**
     * Constructs a new ProvisioningToken.
     * @exports ProvisioningToken
     * @classdesc Represents a ProvisioningToken.
     * @implements IProvisioningToken
     * @constructor
     * @param {IProvisioningToken=} [properties] Properties to set
     */
    function ProvisioningToken(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * ProvisioningToken token.
     * @member {string|null|undefined} token
     * @memberof ProvisioningToken
     * @instance
     */
    ProvisioningToken.prototype.token = null;

    // OneOf field names bound to virtual getters and setters
    let $oneOfFields;

    /**
     * ProvisioningToken _token.
     * @member {"token"|undefined} _token
     * @memberof ProvisioningToken
     * @instance
     */
    Object.defineProperty(ProvisioningToken.prototype, "_token", {
        get: $util.oneOfGetter($oneOfFields = ["token"]),
        set: $util.oneOfSetter($oneOfFields)
    });

    /**
     * Encodes the specified ProvisioningToken message. Does not implicitly {@link ProvisioningToken.verify|verify} messages.
     * @function encode
     * @memberof ProvisioningToken
     * @static
     * @param {IProvisioningToken} message ProvisioningToken message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ProvisioningToken.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.token != null && Object.hasOwnProperty.call(message, "token"))
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.token);
        return writer;
    };

    /**
     * Decodes a ProvisioningToken message from the specified reader or buffer.
     * @function decode
     * @memberof ProvisioningToken
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {ProvisioningToken} ProvisioningToken
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ProvisioningToken.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.ProvisioningToken();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1: {
                    message.token = reader.string();
                    break;
                }
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    return ProvisioningToken;
})();

export const ProvisioningEnvelope = $root.ProvisioningEnvelope = (() => {

    /**
     * Properties of a ProvisioningEnvelope.
     * @exports IProvisioningEnvelope
     * @interface IProvisioningEnvelope
     * @property {Uint8Array|null} [publicKey] ProvisioningEnvelope publicKey
     * @property {Uint8Array|null} [ciphertext] ProvisioningEnvelope ciphertext
     */

    /**
     * Constructs a new ProvisioningEnvelope.
     * @exports ProvisioningEnvelope
     * @classdesc Represents a ProvisioningEnvelope.
     * @implements IProvisioningEnvelope
     * @constructor
     * @param {IProvisioningEnvelope=} [properties] Properties to set
     */
    function ProvisioningEnvelope(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * ProvisioningEnvelope publicKey.
     * @member {Uint8Array|null|undefined} publicKey
     * @memberof ProvisioningEnvelope
     * @instance
     */
    ProvisioningEnvelope.prototype.publicKey = null;

    /**
     * ProvisioningEnvelope ciphertext.
     * @member {Uint8Array|null|undefined} ciphertext
     * @memberof ProvisioningEnvelope
     * @instance
     */
    ProvisioningEnvelope.prototype.ciphertext = null;

    // OneOf field names bound to virtual getters and setters
    let $oneOfFields;

    /**
     * ProvisioningEnvelope _publicKey.
     * @member {"publicKey"|undefined} _publicKey
     * @memberof ProvisioningEnvelope
     * @instance
     */
    Object.defineProperty(ProvisioningEnvelope.prototype, "_publicKey", {
        get: $util.oneOfGetter($oneOfFields = ["publicKey"]),
        set: $util.oneOfSetter($oneOfFields)
    });

    /**
     * ProvisioningEnvelope _ciphertext.
     * @member {"ciphertext"|undefined} _ciphertext
     * @memberof ProvisioningEnvelope
     * @instance
     */
    Object.defineProperty(ProvisioningEnvelope.prototype, "_ciphertext", {
        get: $util.oneOfGetter($oneOfFields = ["ciphertext"]),
        set: $util.oneOfSetter($oneOfFields)
    });

    /**
     * Encodes the specified ProvisioningEnvelope message. Does not implicitly {@link ProvisioningEnvelope.verify|verify} messages.
     * @function encode
     * @memberof ProvisioningEnvelope
     * @static
     * @param {IProvisioningEnvelope} message ProvisioningEnvelope message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ProvisioningEnvelope.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.publicKey != null && Object.hasOwnProperty.call(message, "publicKey"))
            writer.uint32(/* id 1, wireType 2 =*/10).bytes(message.publicKey);
        if (message.ciphertext != null && Object.hasOwnProperty.call(message, "ciphertext"))
            writer.uint32(/* id 2, wireType 2 =*/18).bytes(message.ciphertext);
        return writer;
    };

    /**
     * Decodes a ProvisioningEnvelope message from the specified reader or buffer.
     * @function decode
     * @memberof ProvisioningEnvelope
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {ProvisioningEnvelope} ProvisioningEnvelope
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ProvisioningEnvelope.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.ProvisioningEnvelope();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1: {
                    message.publicKey = reader.bytes();
                    break;
                }
            case 2: {
                    message.ciphertext = reader.bytes();
                    break;
                }
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    return ProvisioningEnvelope;
})();

export const ProvisioningMessage = $root.ProvisioningMessage = (() => {

    /**
     * Properties of a ProvisioningMessage.
     * @exports IProvisioningMessage
     * @interface IProvisioningMessage
     * @property {string|null} [username] ProvisioningMessage username
     * @property {string|null} [password] ProvisioningMessage password
     */

    /**
     * Constructs a new ProvisioningMessage.
     * @exports ProvisioningMessage
     * @classdesc Represents a ProvisioningMessage.
     * @implements IProvisioningMessage
     * @constructor
     * @param {IProvisioningMessage=} [properties] Properties to set
     */
    function ProvisioningMessage(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * ProvisioningMessage username.
     * @member {string|null|undefined} username
     * @memberof ProvisioningMessage
     * @instance
     */
    ProvisioningMessage.prototype.username = null;

    /**
     * ProvisioningMessage password.
     * @member {string|null|undefined} password
     * @memberof ProvisioningMessage
     * @instance
     */
    ProvisioningMessage.prototype.password = null;

    // OneOf field names bound to virtual getters and setters
    let $oneOfFields;

    /**
     * ProvisioningMessage _username.
     * @member {"username"|undefined} _username
     * @memberof ProvisioningMessage
     * @instance
     */
    Object.defineProperty(ProvisioningMessage.prototype, "_username", {
        get: $util.oneOfGetter($oneOfFields = ["username"]),
        set: $util.oneOfSetter($oneOfFields)
    });

    /**
     * ProvisioningMessage _password.
     * @member {"password"|undefined} _password
     * @memberof ProvisioningMessage
     * @instance
     */
    Object.defineProperty(ProvisioningMessage.prototype, "_password", {
        get: $util.oneOfGetter($oneOfFields = ["password"]),
        set: $util.oneOfSetter($oneOfFields)
    });

    /**
     * Encodes the specified ProvisioningMessage message. Does not implicitly {@link ProvisioningMessage.verify|verify} messages.
     * @function encode
     * @memberof ProvisioningMessage
     * @static
     * @param {IProvisioningMessage} message ProvisioningMessage message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ProvisioningMessage.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.username != null && Object.hasOwnProperty.call(message, "username"))
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.username);
        if (message.password != null && Object.hasOwnProperty.call(message, "password"))
            writer.uint32(/* id 2, wireType 2 =*/18).string(message.password);
        return writer;
    };

    /**
     * Decodes a ProvisioningMessage message from the specified reader or buffer.
     * @function decode
     * @memberof ProvisioningMessage
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {ProvisioningMessage} ProvisioningMessage
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ProvisioningMessage.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.ProvisioningMessage();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1: {
                    message.username = reader.string();
                    break;
                }
            case 2: {
                    message.password = reader.string();
                    break;
                }
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    return ProvisioningMessage;
})();

export const StickerPack = $root.StickerPack = (() => {

    /**
     * Properties of a StickerPack.
     * @exports IStickerPack
     * @interface IStickerPack
     * @property {string|null} [title] StickerPack title
     * @property {string|null} [author] StickerPack author
     * @property {StickerPack.ISticker|null} [cover] StickerPack cover
     * @property {Array.<StickerPack.ISticker>|null} [stickers] StickerPack stickers
     */

    /**
     * Constructs a new StickerPack.
     * @exports StickerPack
     * @classdesc Represents a StickerPack.
     * @implements IStickerPack
     * @constructor
     * @param {IStickerPack=} [properties] Properties to set
     */
    function StickerPack(properties) {
        this.stickers = [];
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * StickerPack title.
     * @member {string|null|undefined} title
     * @memberof StickerPack
     * @instance
     */
    StickerPack.prototype.title = null;

    /**
     * StickerPack author.
     * @member {string|null|undefined} author
     * @memberof StickerPack
     * @instance
     */
    StickerPack.prototype.author = null;

    /**
     * StickerPack cover.
     * @member {StickerPack.ISticker|null|undefined} cover
     * @memberof StickerPack
     * @instance
     */
    StickerPack.prototype.cover = null;

    /**
     * StickerPack stickers.
     * @member {Array.<StickerPack.ISticker>} stickers
     * @memberof StickerPack
     * @instance
     */
    StickerPack.prototype.stickers = $util.emptyArray;

    // OneOf field names bound to virtual getters and setters
    let $oneOfFields;

    /**
     * StickerPack _title.
     * @member {"title"|undefined} _title
     * @memberof StickerPack
     * @instance
     */
    Object.defineProperty(StickerPack.prototype, "_title", {
        get: $util.oneOfGetter($oneOfFields = ["title"]),
        set: $util.oneOfSetter($oneOfFields)
    });

    /**
     * StickerPack _author.
     * @member {"author"|undefined} _author
     * @memberof StickerPack
     * @instance
     */
    Object.defineProperty(StickerPack.prototype, "_author", {
        get: $util.oneOfGetter($oneOfFields = ["author"]),
        set: $util.oneOfSetter($oneOfFields)
    });

    /**
     * StickerPack _cover.
     * @member {"cover"|undefined} _cover
     * @memberof StickerPack
     * @instance
     */
    Object.defineProperty(StickerPack.prototype, "_cover", {
        get: $util.oneOfGetter($oneOfFields = ["cover"]),
        set: $util.oneOfSetter($oneOfFields)
    });

    /**
     * Encodes the specified StickerPack message. Does not implicitly {@link StickerPack.verify|verify} messages.
     * @function encode
     * @memberof StickerPack
     * @static
     * @param {IStickerPack} message StickerPack message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    StickerPack.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.title != null && Object.hasOwnProperty.call(message, "title"))
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.title);
        if (message.author != null && Object.hasOwnProperty.call(message, "author"))
            writer.uint32(/* id 2, wireType 2 =*/18).string(message.author);
        if (message.cover != null && Object.hasOwnProperty.call(message, "cover"))
            $root.StickerPack.Sticker.encode(message.cover, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
        if (message.stickers != null && message.stickers.length)
            for (let i = 0; i < message.stickers.length; ++i)
                $root.StickerPack.Sticker.encode(message.stickers[i], writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
        return writer;
    };

    /**
     * Decodes a StickerPack message from the specified reader or buffer.
     * @function decode
     * @memberof StickerPack
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {StickerPack} StickerPack
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    StickerPack.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.StickerPack();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1: {
                    message.title = reader.string();
                    break;
                }
            case 2: {
                    message.author = reader.string();
                    break;
                }
            case 3: {
                    message.cover = $root.StickerPack.Sticker.decode(reader, reader.uint32());
                    break;
                }
            case 4: {
                    if (!(message.stickers && message.stickers.length))
                        message.stickers = [];
                    message.stickers.push($root.StickerPack.Sticker.decode(reader, reader.uint32()));
                    break;
                }
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    StickerPack.Sticker = (function() {

        /**
         * Properties of a Sticker.
         * @memberof StickerPack
         * @interface ISticker
         * @property {number|null} [id] Sticker id
         * @property {string|null} [emoji] Sticker emoji
         */

        /**
         * Constructs a new Sticker.
         * @memberof StickerPack
         * @classdesc Represents a Sticker.
         * @implements ISticker
         * @constructor
         * @param {StickerPack.ISticker=} [properties] Properties to set
         */
        function Sticker(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Sticker id.
         * @member {number|null|undefined} id
         * @memberof StickerPack.Sticker
         * @instance
         */
        Sticker.prototype.id = null;

        /**
         * Sticker emoji.
         * @member {string|null|undefined} emoji
         * @memberof StickerPack.Sticker
         * @instance
         */
        Sticker.prototype.emoji = null;

        // OneOf field names bound to virtual getters and setters
        let $oneOfFields;

        /**
         * Sticker _id.
         * @member {"id"|undefined} _id
         * @memberof StickerPack.Sticker
         * @instance
         */
        Object.defineProperty(Sticker.prototype, "_id", {
            get: $util.oneOfGetter($oneOfFields = ["id"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        /**
         * Sticker _emoji.
         * @member {"emoji"|undefined} _emoji
         * @memberof StickerPack.Sticker
         * @instance
         */
        Object.defineProperty(Sticker.prototype, "_emoji", {
            get: $util.oneOfGetter($oneOfFields = ["emoji"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        /**
         * Encodes the specified Sticker message. Does not implicitly {@link StickerPack.Sticker.verify|verify} messages.
         * @function encode
         * @memberof StickerPack.Sticker
         * @static
         * @param {StickerPack.ISticker} message Sticker message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Sticker.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.id);
            if (message.emoji != null && Object.hasOwnProperty.call(message, "emoji"))
                writer.uint32(/* id 2, wireType 2 =*/18).string(message.emoji);
            return writer;
        };

        /**
         * Decodes a Sticker message from the specified reader or buffer.
         * @function decode
         * @memberof StickerPack.Sticker
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {StickerPack.Sticker} Sticker
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Sticker.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.StickerPack.Sticker();
            while (reader.pos < end) {
                let tag = reader.uint32();
                switch (tag >>> 3) {
                case 1: {
                        message.id = reader.uint32();
                        break;
                    }
                case 2: {
                        message.emoji = reader.string();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        return Sticker;
    })();

    return StickerPack;
})();

export { $root as default };

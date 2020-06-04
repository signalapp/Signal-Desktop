import { expect, should } from 'chai';
import { SignalService } from '../../../protobuf';
import { ChatMessage } from '../../../session/messages/outgoing';
import { RawMessage } from '../../../session/types/RawMessage';
import { MessageUtils, PubKey, PubKeyType } from '../../../session/utils';

describe('MessageUtils', () => {
    it('can convert to RawMessage', () => {
      // TOOD: MOVE ME TO MESSAGE UTILS TEST
      const pubkey = "0582fe8822c684999663cc6636148328fbd47c0836814c118af4e326bb4f0e1000";
      const messageText = "This is some message content";

      const isRawMessage = (object: any): object is RawMessage => {
        return (
          'identifier' in object &&
          'plainTextBuffer' in object &&
          'timestamp' in object &&
          'device' in object &&
          'ttl' in object &&
          'encryption' in object
        );
      }

      const message = new ChatMessage({
        body: messageText,
        identifier: '1234567890',
        timestamp: Date.now(),
        attachments: undefined,
        quote: undefined,
        expireTimer: undefined,
        lokiProfile: undefined,
        preview: undefined,      
      });

      // Explicitly check that it's a RawMessage
      const rawMessage = MessageUtils.toRawMessage(pubkey, message);
      expect(isRawMessage(rawMessage)).to.be.equal(true);

      // console.log('[vince] isRawMessage(rawMessage):', isRawMessage(rawMessage));

      // Check plaintext
      const plainText = message.plainTextBuffer();
      const decoded = SignalService.Content.decode(plainText);
      expect(decoded.dataMessage?.body).to.be.equal(messageText);
    });

    // Pubkeys
    it('can create new valid pubkey', () => {
      const validPubkey = '0582fe8822c684999663cc6636148328fbd47c0836814c118af4e326bb4f0e1000';
      should().not.Throw(() => new PubKey(validPubkey), Error);
      
      const pubkey = new PubKey(validPubkey);
      expect(pubkey instanceof PubKey).to.be.equal(true);
    });

    it('invalid pubkey should throw error', () => {
      const invalidPubkey = 'Lorem Ipsum';

      should().Throw(() => new PubKey(invalidPubkey), Error);
    });

    it('can set pubkey type', () => {
      const validPubkey = '0582fe8822c684999663cc6636148328fbd47c0836814c118af4e326bb4f0e1000';
      const pubkeyType = PubKeyType.Primary;

      should().not.Throw(() => new PubKey(validPubkey, pubkeyType), Error);
      
      const pubkey = new PubKey(validPubkey, pubkeyType);
      expect(pubkey.type).to.be.equal(PubKeyType.Primary);
    });

});
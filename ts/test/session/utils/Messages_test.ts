import chai from 'chai';
import { generateChatMessage, generateFakePubKey } from '../../test-utils/testUtils';
import { toRawMessage } from '../../../session/utils/Messages';
import { PubKey } from '../../../session/types/';

// tslint:disable-next-line: no-require-imports no-var-requires
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

const { expect } = chai;

describe('Message Utils', () => {

  describe('toRawMessage', () => {
    it('can convert to raw message', async () => {
      const device = generateFakePubKey();
      const message = generateChatMessage();

      const rawMessage = toRawMessage(device, message);

      expect(Object.keys(rawMessage)).to.have.length(6);
      expect(rawMessage.identifier).to.exist;
      expect(rawMessage.device).to.exist;
      expect(rawMessage.encryption).to.exist;
      expect(rawMessage.plainTextBuffer).to.exist;
      expect(rawMessage.timestamp).to.exist;
      expect(rawMessage.ttl).to.exist;
    });

    it('should generate valid plainTextBuffer', async () => {
      const device = generateFakePubKey();
      const message = generateChatMessage();

      const rawMessage = toRawMessage(device, message);

      const rawBuffer = rawMessage.plainTextBuffer;
      const rawBufferJSON = JSON.stringify(rawBuffer);
      const messageBufferJSON = JSON.stringify(message.plainTextBuffer());

      expect(rawBuffer instanceof Uint8Array).to.equal(true, 'raw message did not contain a plainTextBuffer');
      expect(rawBufferJSON).to.equal(messageBufferJSON, 'plainTextBuffer was not converted correctly');
    });

    it('should maintain pubkey', async () => {
      const device = generateFakePubKey();
      const message = generateChatMessage();

      const rawMessage = toRawMessage(device, message);
      const derivedPubKey = PubKey.from(rawMessage.device);

      expect(derivedPubKey).to.exist;
      expect(derivedPubKey?.isEqual(device)).to.equal(true, 'pubkey of message was not converted correctly');
    });

  });
});

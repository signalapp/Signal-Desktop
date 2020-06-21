import chai from 'chai';
import { generateChatMessage, generateFakePubKey } from '../../test-utils/testUtils';
import { toRawMessage } from '../../../session/utils/Messages';
import { PubKey } from '../../../session/types/';
import { from } from '../../../session/utils/SyncMessage';

// tslint:disable-next-line: no-require-imports no-var-requires
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

const { expect } = chai;

describe('Sync Message Utils', () => {

  describe('from', () => {
    it('can convert to sync message', async () => {
      const message = generateChatMessage();

      const syncMessage = from(message);
      // Stubbed
    });


  });

  describe('canSync', () => {
    it('', async () => {
      
    });

  });

  describe('getSyncContacts', () => {
    it('', async () => {
      
    });

  });



  
});

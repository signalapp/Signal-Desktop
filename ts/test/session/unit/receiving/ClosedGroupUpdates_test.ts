// tslint:disable: no-implicit-dependencies max-func-body-length no-unused-expression

import chai from 'chai';
import _ from 'lodash';
import { describe } from 'mocha';

import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised as any);

// tslint:disable-next-line: max-func-body-length
describe('ClosedGroupUpdates', () => {
  //FIXME AUDRIC TODO
  // Initialize new stubbed cache
  // const sandbox = sinon.createSandbox();
  // const ourDevice = TestUtils.generateFakePubKey();
  // const ourNumber = ourDevice.key;
  // const groupId = TestUtils.generateFakePubKey().key;
  // const members = TestUtils.generateFakePubKeys(10);
  // const sender = members[3].key;
  // const getConvo = sandbox.stub(ConversationController.getInstance(), 'get');
  // beforeEach(async () => {
  //   // Utils Stubs
  //   sandbox.stub(UserUtils, 'getCurrentDevicePubKey').resolves(ourNumber);
  // });
  // afterEach(() => {
  //   TestUtils.restoreStubs();
  //   sandbox.restore();
  // });
  // describe('handleClosedGroupControlMessage', () => {
  //   describe('performIfValid', () => {
  //     it('does not perform if convo does not exist', async () => {
  //       const envelope = generateEnvelopePlusClosedGroup(groupId, sender);
  //       const groupUpdate = generateGroupUpdateNameChange(groupId);
  //       getConvo.returns(undefined as any);
  //       await handleClosedGroupControlMessage(envelope, groupUpdate);
  //     });
  //   });
  //   // describe('handleClosedGroupNameChanged', () => {
  //   //     it('does not trigger an update of the group if the name is the same', async () => {
  //   //         const envelope = generateEnvelopePlusClosedGroup(groupId, sender);
  //   //         const groupUpdate = generateGroupUpdateNameChange(groupId);
  //   //         await handleClosedGroupControlMessage(envelope, groupUpdate);
  //   //     });
  //   // });
  // });
});

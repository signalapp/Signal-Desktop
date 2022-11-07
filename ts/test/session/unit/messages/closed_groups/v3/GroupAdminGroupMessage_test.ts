// import { expect } from 'chai';

// import { SignalService } from '../../../../../../protobuf';
// import { TestUtils } from '../../../../../test-utils';
// import { GroupAdminGroupMessage } from '../../../../../../session/messages/outgoing/controlMessage/group/v3/GroupAdminGroupMessage';
// import { v4 } from 'uuid';
// import { Constants } from '../../../../../../session';
// import { from_hex } from 'libsodium-wrappers-sumo';

describe('GroupAdminGroupMessage', () => {
  // let groupPk: string;
  // beforeEach(async () => {
  //   groupPk = TestUtils.generateFakeClosedGroupV3PkStr();
  // });
  // it('can create valid message with array of members', async () => {
  //   const member = TestUtils.generateFakePubKeyStr();
  //   const message = new GroupAdminGroupMessage({
  //     timestamp: 12345,
  //     identifier: v4(),
  //     members: [member],
  //   });
  //   const plainText = message.plainTextBuffer();
  //   const decoded = SignalService.Content.decode(plainText);
  //   expect(decoded.dataMessage)
  //     .to.have.property('groupMessage')
  //     .to.have.deep.property('publicKey', from_hex(groupPk));
  //   expect(decoded.dataMessage)
  //     .to.have.property('closedGroupControlMessage')
  //     .to.have.deep.property('members', [member].map(from_hex));
  //   expect(message)
  //     .to.have.property('timestamp')
  //     .to.be.equal(12345);
  // });
  // it('correct ttl', () => {
  //   const message = new GroupAdminGroupMessage({
  //     timestamp: 12345,
  //     identifier: v4(),
  //     members: [TestUtils.generateFakePubKeyStr()],
  //   });
  //   expect(message.ttl()).to.equal(Constants.TTL_DEFAULT.TTL_MAX);
  // });
  // it('has an identifier even if none are provided', () => {
  //   const message = new GroupAdminGroupMessage({
  //     timestamp: 12345,
  //     members: [TestUtils.generateFakePubKeyStr()],
  //   });
  //   expect(message.identifier).to.not.equal(null, 'identifier cannot be null');
  //   expect(message.identifier).to.not.equal(undefined, 'identifier cannot be undefined');
  // });
  // it('has the right type', () => {
  //   const message = new GroupAdminGroupMessage({
  //     timestamp: 12345,
  //     identifier: v4(),
  //     members: [TestUtils.generateFakePubKeyStr()],
  //   });
  //   const plainText = message.plainTextBuffer();
  //   const decoded = SignalService.Content.decode(plainText);
  //   expect(decoded.dataMessage)
  //     .to.have.property('closedGroupControlMessage')
  //     .to.have.deep.property(
  //       'type',
  //       SignalService.DataMessage.ClosedGroupControlMessage.Type.PROMOTE
  //     );
  // });
  // describe('constructor throws on invalid ', () => {
  //   it('groupPk empty', () => {
  //     expect(() => {
  //       new GroupAdminGroupMessage({
  //         timestamp: 12345,
  //         members: [TestUtils.generateFakePubKeyStr()],
  //       });
  //     }).throws();
  //   });
  //   it('groupPk does not have group v3 prefix', () => {
  //     expect(() => {
  //       new GroupAdminGroupMessage({
  //         timestamp: 12345,
  //         members: [TestUtils.generateFakePubKeyStr()],
  //       });
  //     }).throws();
  //   });
  //   it('groupPk does not have group v3 length', () => {
  //     expect(() => {
  //       new GroupAdminGroupMessage({
  //         timestamp: 12345,
  //         members: [TestUtils.generateFakePubKeyStr()],
  //       });
  //     }).throws();
  //   });
  //   it('members is empty', () => {
  //     expect(() => {
  //       new GroupAdminGroupMessage({
  //         timestamp: 12345,
  //         members: undefined as any,
  //       });
  //     }).throws();
  //   });
  //   it('members is not an Array', () => {
  //     expect(() => {
  //       new GroupAdminGroupMessage({
  //         timestamp: 12345,
  //         members: '05123456' as any,
  //       });
  //     }).throws();
  //   });
  //   it('members array has one not a hex string', () => {
  //     expect(() => {
  //       new GroupAdminGroupMessage({
  //         timestamp: 12345,
  //         members: [TestUtils.generateFakePubKeyStr(), '05ggggggggggg'],
  //       });
  //     }).throws();
  //   });
  //   it('members array has one item not a valid pubkey and not a `*`', () => {
  //     expect(() => {
  //       new GroupAdminGroupMessage({
  //         timestamp: 12345,
  //         members: ['03opoerpero'],
  //       });
  //     }).throws();
  //   });
  // });
});

// import { expect } from 'chai';

// import { SignalService } from '../../../../../../protobuf';
// import { v4 } from 'uuid';
// import { Constants } from '../../../../../../session';
// import { GroupMemberLeftMessage } from '../../../../../../session/messages/outgoing/controlMessage/group/v3/GroupMemberLeftMessage';

// describe('GroupMemberLeftMessage', () => {
//   beforeEach(async () => {});

//   it('can create valid message', async () => {
//     const message = new GroupMemberLeftMessage({
//       timestamp: 12345,
//       identifier: v4(),
//     });

//     const plainText = message.plainTextBuffer();
//     const decoded = SignalService.Content.decode(plainText);
//     expect(decoded.dataMessage)
//       .to.have.property('groupMessage')
//       .to.have.property('memberLeftMessage').to.be.not.undefined;
//     expect(decoded.dataMessage)
//       .to.have.property('groupMessage')
//       .to.have.property('memberLeftMessage').to.be.not.null;

//       expect(decoded.dataMessage)
//       .to.have.property('groupMessage')
//       .to.have.property('memberLeftMessage').to.be.empty;
//     expect(message)
//       .to.have.property('timestamp')
//       .to.be.equal(12345);
//   });

//   it('correct ttl', () => {
//     const message = new GroupMemberLeftMessage({
//       timestamp: 12345,
//       identifier: v4(),
//     });

//     expect(message.ttl()).to.equal(Constants.TTL_DEFAULT.TTL_MAX);
//   });

//   it('has an identifier even if none are provided', () => {
//     const message = new GroupMemberLeftMessage({
//       timestamp: 12345,
//     });

//     expect(message.identifier).to.not.equal(null, 'identifier cannot be null');
//     expect(message.identifier).to.not.equal(undefined, 'identifier cannot be undefined');
//   });

// });

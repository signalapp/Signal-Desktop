// import { SignalService } from '../../../../../../protobuf';
// import { isArray } from 'lodash';
// import { GroupMessage, GroupMessageParams } from './GroupMessage';
// // import { PubKey } from '../../../../../types';
// // import { from_hex } from 'libsodium-wrappers-sumo';

// interface GroupAdminMessageParams extends GroupMessageParams {
//   /*
//    * A proof that we are an admin (a proof that we have access to the private key of the closed group).
//    * this field is needed  for all types of admin messages so that every member can make
//    */
//   groupSignature: Uint8Array;
// }

// interface GroupAdminMessageParams extends GroupMessageParams {
//   /**
//    * hex string of the members to delete the group from.
//    * a single '*' is allowed too and means 'every members'
//    *
//    */
//   members: Array<string>;
// }

// export class GroupAdminGroupMessage extends GroupMessage {
//   // private readonly members: Array<string>;

//   constructor(params: GroupAdminMessageParams) {
//     super(params);

//     if (!params.members || !isArray(params.members) || !params.members.length) {
//       throw new Error('members parameter must be set');
//     }

//     // if (params.members.length === 1 && params.members[0] === '*') {
//     //   this.members = params.members;
//     // } else {
//     //   const allAreValid = params.members.every(PubKey.isValidGroupPubkey);
//     //   if (!allAreValid) {
//     //     throw new Error('One of the members is not a `isValidGroupPubkey`');
//     //   }

//     //   this.members = params.members;
//     // }
//     throw new Error('TODO and add tests');
//   }

//   public dataProto(): SignalService.DataMessage {
//     const dataMessage = new SignalService.DataMessage();
//     dataMessage.groupMessage = super.groupMessage();
//     dataMessage.groupMessage.adminMessage = new SignalService.GroupAdminMessage();
//     // dataMessage.groupMessage.members = this.members.map(from_hex);

//     return dataMessage;
//   }
// }



// This is the (Closed | Medium) Group equivalent to the SessionGroup type.

import { PubKey } from '.';
import { UserUtil } from '../../util';
import { MultiDeviceProtocol } from '../protocols';

enum ClosedGroupType {
    SMALL,
    MEDIUM,
}

interface ClosedGroupParams {
    id: PubKey;
    type: ClosedGroupType;
    admins: Array<PubKey>;
    members: Array<PubKey>;
}

class ClosedGroup {
  public readonly id: PubKey;
  public readonly type: ClosedGroupType;
  public admins: Array<PubKey>;
  public members: Array<PubKey>;

  constructor(params: ClosedGroupParams) {
    this.id = params.id;
    this.type = params.type;
    this.admins = params.admins;
    this.members = params.members;
  }

  public static async create(name: string, type: ClosedGroupType, members: Array<PubKey>, onSuccess: any): Promise<ClosedGroup | undefined> {
    const { ConversationController, StringView, libsignal } = window;

    // Manage small group size
    // TODO - Eventually we want to default to MediumGroups and abandon regular groups
    // once medium groups have been thoroughly tested
    if (
      type === ClosedGroupType.SMALL &&
      members.length === 0 ||
      members.length >= window.CONSTANTS.SMALL_GROUP_SIZE_LIMIT
    ) {
      console.warn(`ClosedGroup create: Cannot create a small group with more than ${window.CONSTANTS.SMALL_GROUP_SIZE_LIMIT} members`);
    }

    const user = await UserUtil.getCurrentDevicePubKey();
    if (!user) {
        return;
    }

    const primaryDevice = await MultiDeviceProtocol.getPrimaryDevice(user);
    const allMembers = [primaryDevice, ...members];

    // Create Group Identity
    const identityKeys = await libsignal.KeyHelper.generateIdentityKeyPair();

    const keypair = await libsignal.KeyHelper.generateIdentityKeyPair();
    const id = StringView.arrayBufferToHex(keypair.pubKey);

    // Medium groups
    const senderKey = (type === ClosedGroupType.MEDIUM)
        ? await window.SenderKeyAPI.createSenderKeyForGroup(id, primaryDevice)
        : undefined;

    const secretKey = (type === ClosedGroupType.MEDIUM)
        ? identityKeys.privKey
        : undefined;

    const groupSecretKeyHex = StringView.arrayBufferToHex(
    identityKeys.privKey
    );

    const ev = {
    groupDetails: {
        id,
        name,
        members: allMembers,
        recipients: allMembers,
        active: true,
        expireTimer: 0,
        avatar: '',
        secretKey,
        senderKey,
        is_medium_group: type === ClosedGroupType.MEDIUM,
    },
    confirm: () => null,
    };

    await window.NewReceiver.onGroupReceived(ev);
    }

    public static get(id: PubKey): ClosedGroup | undefined {
        // Gets a closed group from its group id
        return;
    }

    public update(): Promise<Array<PubKey>> {
        // 
    }

    public updateMembers(): Promise<Array<PubKey>> {
        // Abstraction on update

        // Update the conversation and this object
    }

    public async removeMembers(): Promise<Array<PubKey>> {
        // Abstraction on updateMembers
    }

    public async addMembers(): Promise<Array<PubKey>> {
        // Abstraction on updateMembers
    }

    public async setName(): Promise<void> {
        // Set or update the name of the group
    }

    public leave() {
        // Leave group
    }


    //   static from(groupId) {
    //       // Returns a new instance from a groupId if it's valid
    //       const groupIdAsPubKey = groupId instanceof _1.PubKey
    //           ? groupId
    //           : _1.PubKey.from(groupId);
    //       openGroupParams = {
    //           groupId: 
    //       };
    //       return new SessionGroup(openGroupParams);
    //   }


}



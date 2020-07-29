// tslint:disable: no-unnecessary-class
export class FindMember {
  public static async findMember(
    pubkey: String,
    convoId: string,
    clearOurInterval?: any
  ) {
    let groupMembers;

    const groupConvos = window.getConversations().models.filter((d: any) => {
      return !d.isPrivate();
    });
    const thisConvo = groupConvos.find((d: any) => {
      return d.id === convoId;
    });

    if (!thisConvo) {
      // If this gets triggered, is is likely because we deleted the conversation
      if (clearOurInterval) {
        clearOurInterval();
      }

      return;
    }

    if (thisConvo.isPublic()) {
      groupMembers = await window.lokiPublicChatAPI.getListOfMembers();
      groupMembers = groupMembers.filter((m: any) => !!m);
    } else {
      const privateConvos = window
        .getConversations()
        .models.filter((d: any) => d.isPrivate());
      const members = thisConvo.attributes.members;
      if (!members) {
        return null;
      }
      const memberConversations = members
        .map((m: any) => privateConvos.find((c: any) => c.id === m))
        .filter((c: any) => !!c);
      groupMembers = memberConversations.map((m: any) => {
        const name = m.getLokiProfile()
          ? m.getLokiProfile().displayName
          : m.attributes.displayName;

        return {
          id: m.id,
          authorPhoneNumber: m.id,
          authorProfileName: name,
        };
      });
    }

    return groupMembers.find(
      ({ authorPhoneNumber: pn }: any) => pn && pn === pubkey
    );
  }
}

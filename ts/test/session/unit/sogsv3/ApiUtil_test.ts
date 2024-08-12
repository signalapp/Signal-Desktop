/* eslint-disable no-unused-expressions */
import { expect } from 'chai';
import Sinon from 'sinon';
import { OpenGroupData } from '../../../../data/opengroups';
import {
  hasExistingOpenGroup,
  isSessionRunOpenGroup,
} from '../../../../session/apis/open_group_api/opengroupV2/ApiUtil';
import { getOpenGroupV2ConversationId } from '../../../../session/apis/open_group_api/utils/OpenGroupUtils';
import { getConversationController } from '../../../../session/conversations';
import { stubData, stubOpenGroupData, stubWindowLog } from '../../../test-utils/utils';
import { UserUtils } from '../../../../session/utils';
import { TestUtils } from '../../../test-utils';
import { OpenGroupV2Room } from '../../../../data/types';
import { ConversationTypeEnum } from '../../../../models/types';

describe('APIUtils', () => {
  beforeEach(() => {
    stubWindowLog();
  });
  afterEach(() => {
    Sinon.restore();
  });

  describe('isSessionRunOpenGroup', () => {
    it('returns false undefined serverUrl', () => {
      expect(isSessionRunOpenGroup(undefined as any)).to.be.false;
    });
    it('returns false empty serverUrl', () => {
      expect(isSessionRunOpenGroup('')).to.be.false;
    });
    it('returns false invalid URL', () => {
      expect(isSessionRunOpenGroup('kfdjfdfdl://sdkfjsd')).to.be.false;
    });
    it('returns true if url matches ip without prefix', () => {
      expect(isSessionRunOpenGroup('116.203.70.33')).to.be.true;
    });
    it('returns true if url matches ip http prefix', () => {
      expect(isSessionRunOpenGroup('http://116.203.70.33')).to.be.true;
    });
    it('returns true if url matches ip https prefix', () => {
      expect(isSessionRunOpenGroup('https://116.203.70.33')).to.be.true;
    });
    it('returns true if url matches ip https prefix and port', () => {
      expect(isSessionRunOpenGroup('https://116.203.70.33:443')).to.be.true;
    });
    it('returns true if url matches ip http prefix and port', () => {
      expect(isSessionRunOpenGroup('http://116.203.70.33:80')).to.be.true;
    });
    it('returns true if url matches ip http prefix and custom port', () => {
      expect(isSessionRunOpenGroup('http://116.203.70.33:4433')).to.be.true;
    });

    it('returns true if url matches hostname without prefix', () => {
      expect(isSessionRunOpenGroup('open.getsession.org')).to.be.true;
    });
    it('returns true if url matches hostname http prefix', () => {
      expect(isSessionRunOpenGroup('http://open.getsession.org')).to.be.true;
    });
    it('returns true if url matches hostname https prefix', () => {
      expect(isSessionRunOpenGroup('https://open.getsession.org')).to.be.true;
    });
    it('returns true if url matches hostname https prefix and port', () => {
      expect(isSessionRunOpenGroup('https://open.getsession.org:443')).to.be.true;
    });
    it('returns true if url matches hostname http prefix and port', () => {
      expect(isSessionRunOpenGroup('http://open.getsession.org:80')).to.be.true;
    });
    it('returns true if url matches hostname http prefix and port and not lowercased', () => {
      expect(isSessionRunOpenGroup('http://open.GETSESSION.org:80')).to.be.true;
    });
    it('returns true if url matches hostname http prefix and custom port', () => {
      expect(isSessionRunOpenGroup('http://open.getsession.org:4433')).to.be.true;
    });
  });

  describe('hasExistingOpenGroup', () => {
    it('returns false undefined serverUrl', () => {
      expect(hasExistingOpenGroup(undefined as any, '')).to.be.false;
    });
    it('returns false empty serverUrl', () => {
      expect(hasExistingOpenGroup('', '')).to.be.false;
    });
    describe('no matching room', () => {
      beforeEach(async () => {
        stubData('getAllConversations').resolves([]);
        stubData('saveConversation').resolves();
        stubData('getItemById').resolves();
        stubOpenGroupData('getAllV2OpenGroupRooms').resolves();
        getConversationController().reset();

        await getConversationController().load();
        await OpenGroupData.opengroupRoomsLoad();
      });
      afterEach(() => {
        Sinon.restore();
      });
      describe('is a session run opengroup', () => {
        it('returns false if there no rooms matching that serverURL with http prefix', () => {
          expect(hasExistingOpenGroup('http://116.203.70.33', 'roomId')).to.be.false;
        });
        it('returns false if there no rooms matching that serverURL with https prefix', () => {
          expect(hasExistingOpenGroup('https://116.203.70.33', 'roomId')).to.be.false;
        });
        it('returns false if there no rooms matching that serverURL no prefix', () => {
          expect(hasExistingOpenGroup('116.203.70.33', 'roomId')).to.be.false;
        });
        it('returns false if there no rooms matching that serverURL no prefix with port', () => {
          expect(hasExistingOpenGroup('http://116.203.70.33:4433', 'roomId')).to.be.false;
        });

        it('returns false if there no rooms matching that serverURL domain no prefix with port', () => {
          expect(hasExistingOpenGroup('http://open.getsession.org:4433', 'roomId')).to.be.false;
        });
      });
      describe('is NOT a SESSION run opengroup', () => {
        it('returns false if there no rooms matching that serverURL with http prefix', () => {
          expect(hasExistingOpenGroup('http://1.1.1.1', 'roomId')).to.be.false;
          expect(hasExistingOpenGroup('http://1.1.1.1:4433', 'roomId')).to.be.false;
          expect(hasExistingOpenGroup('http://whatever.com:4433', 'roomId')).to.be.false;
          expect(hasExistingOpenGroup('https://whatever.com', 'roomId')).to.be.false;
        });
      });
    });

    describe('has matching rooms', () => {
      let getV2OpenGroupRoomsByServerUrl: Sinon.SinonStub;
      const convoIdOurIp = getOpenGroupV2ConversationId('116.203.70.33', 'fish');
      const convoIdOurUrl = getOpenGroupV2ConversationId('open.getsession.org', 'fishUrl');
      const convoIdNotOur = getOpenGroupV2ConversationId('open.somethingelse.org', 'fishElse');

      beforeEach(async () => {
        stubData('getAllConversations').resolves([]);
        stubData('saveConversation').resolves();
        stubData('getItemById').resolves();
        stubOpenGroupData('getAllV2OpenGroupRooms').resolves();
        getV2OpenGroupRoomsByServerUrl = stubOpenGroupData('getV2OpenGroupRoomsByServerUrl');
        getConversationController().reset();

        Sinon.stub(UserUtils, 'getOurPubKeyStrFromCache').returns(
          TestUtils.generateFakePubKeyStr()
        );

        await getConversationController().load();

        const convoOurIp = await getConversationController().getOrCreateAndWait(
          convoIdOurIp,
          ConversationTypeEnum.GROUP
        );
        convoOurIp.set({ active_at: Date.now() });
        const convoOurUrl = await getConversationController().getOrCreateAndWait(
          convoIdOurUrl,
          ConversationTypeEnum.GROUP
        );
        convoOurUrl.set({ active_at: Date.now() });
        const convoNotOur = await getConversationController().getOrCreateAndWait(
          convoIdNotOur,
          ConversationTypeEnum.GROUP
        );
        convoNotOur.set({ active_at: Date.now() });
        await OpenGroupData.opengroupRoomsLoad();
      });
      afterEach(() => {
        Sinon.restore();
      });
      describe('is a session run opengroup', () => {
        it('returns false if there no rooms matching that ip and roomID ', () => {
          const rooms: Array<OpenGroupV2Room> = [];
          getV2OpenGroupRoomsByServerUrl.returns(rooms);
          expect(hasExistingOpenGroup('http://116.203.70.33', 'roomId')).to.be.false;
          expect(hasExistingOpenGroup('116.203.70.33', 'roomId')).to.be.false;
          expect(hasExistingOpenGroup('https://116.203.70.33', 'roomId')).to.be.false;
        });
        it('returns true if there a room matching that ip and roomID ', () => {
          const rooms: Array<OpenGroupV2Room> = [
            {
              roomId: 'fish',
              serverUrl: 'http://116.203.70.33',
              serverPublicKey: 'whatever',
              conversationId: convoIdOurIp,
            },
          ];
          getV2OpenGroupRoomsByServerUrl.returns(rooms);

          expect(hasExistingOpenGroup('http://116.203.70.33', 'fish')).to.be.true;
          expect(hasExistingOpenGroup('116.203.70.33', 'fish')).to.be.true;
          expect(hasExistingOpenGroup('https://116.203.70.33', 'fish')).to.be.true;
          expect(hasExistingOpenGroup('https://116.203.70.33', 'fish2')).to.be.false;
        });

        it('returns true if there a room matching that url and roomID ', () => {
          const rooms: Array<OpenGroupV2Room> = [
            {
              roomId: 'fishUrl',
              serverUrl: 'http://open.getsession.org',
              serverPublicKey: 'whatever',
              conversationId: convoIdOurUrl,
            },
          ];
          getV2OpenGroupRoomsByServerUrl.returns(rooms);

          expect(hasExistingOpenGroup('http://open.getsession.org', 'fishUrl')).to.be.true;
          expect(hasExistingOpenGroup('open.getsession.org', 'fishUrl')).to.be.true;
          expect(hasExistingOpenGroup('https://open.getsession.org', 'fishUrl')).to.be.true;
          expect(hasExistingOpenGroup('https://open.getsession.org', 'fish2')).to.be.false;
        });
      });
    });
  });
});

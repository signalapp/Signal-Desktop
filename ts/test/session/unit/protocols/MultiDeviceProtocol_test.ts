import { expect } from 'chai';
import * as sinon from 'sinon';
import { TestUtils } from '../../../test-utils';
import { PairingAuthorisation } from '../../../../../js/modules/data';
import { MultiDeviceProtocol } from '../../../../session/protocols';
import { PubKey } from '../../../../session/types';
import { UserUtil } from '../../../../util';
import { StringUtils } from '../../../../session/utils';

function generateFakeAuthorisations(
  primary: PubKey,
  otherDevices: Array<PubKey>
): Array<PairingAuthorisation> {
  return otherDevices.map(
    device =>
      ({
        primaryDevicePubKey: primary.key,
        secondaryDevicePubKey: device.key,
        requestSignature: new Uint8Array(0),
        grantSignature: new Uint8Array(1),
      } as PairingAuthorisation)
  );
}

describe('MultiDeviceProtocol', () => {
  const sandbox = sinon.createSandbox();

  beforeEach(() => {
    // Enable multidevice for tests
    TestUtils.stubWindow('lokiFeatureFlags', {
      useMultiDevice: true,
    });
  });

  afterEach(() => {
    TestUtils.restoreStubs();
    sandbox.restore();
  });

  describe('getPairingAuthorisations', () => {
    let fetchPairingStub: sinon.SinonStub<[PubKey], Promise<void>>;
    beforeEach(() => {
      fetchPairingStub = sandbox
        .stub(MultiDeviceProtocol, 'fetchPairingAuthorisationsIfNeeded')
        .resolves();
    });

    it('should fetch pairing authorisations before getting authorisations from the database', async () => {
      const dataStub = TestUtils.stubData(
        'getPairingAuthorisationsFor'
      ).resolves([]);
      await MultiDeviceProtocol.getPairingAuthorisations(
        TestUtils.generateFakePubKey()
      );
      expect(fetchPairingStub.called).to.equal(true, 'Pairing is not fetched.');
      expect(fetchPairingStub.calledBefore(dataStub)).to.equal(
        true,
        'Database result was fetched before network result'
      );
    });

    it('should return the authorisations from the database', async () => {
      const device1 = TestUtils.generateFakePubKey();
      const device2 = TestUtils.generateFakePubKey();
      const pairing: PairingAuthorisation = {
        primaryDevicePubKey: device1.key,
        secondaryDevicePubKey: device2.key,
        requestSignature: new Uint8Array(1),
        grantSignature: new Uint8Array(2),
      };
      TestUtils.stubData('getPairingAuthorisationsFor').resolves([pairing]);
      const a1 = await MultiDeviceProtocol.getPairingAuthorisations(device1);
      expect(a1).to.deep.equal([pairing]);

      const a2 = await MultiDeviceProtocol.getPairingAuthorisations(device2);
      expect(a2).to.deep.equal([pairing]);
    });
  });

  describe('fetchPairingAuthorisations', () => {
    let verifyAuthorisationStub: sinon.SinonStub<
      [PairingAuthorisation],
      Promise<boolean>
    >;
    beforeEach(() => {
      verifyAuthorisationStub = sandbox
        .stub<[PairingAuthorisation], Promise<boolean>>()
        .resolves(true);
      TestUtils.stubWindow('libloki', {
        crypto: {
          verifyAuthorisation: verifyAuthorisationStub,
        } as any,
      });
    });

    it('should throw if lokiFileServerAPI does not exist', async () => {
      TestUtils.stubWindow('lokiFileServerAPI', undefined);
      expect(
        MultiDeviceProtocol.fetchPairingAuthorisations(
          TestUtils.generateFakePubKey()
        )
      ).to.be.rejectedWith('lokiFileServerAPI is not initialised.');
    });

    it('should return the authorisations', async () => {
      const networkAuth = {
        primaryDevicePubKey:
          '05caa6310a490415df45f8f4ad1b3655ad7a11e722257887a30cf71601d679720b',
        secondaryDevicePubKey:
          '051296b9588641eea268d60ad6636eecb53a95150e91c0531a00203e01a2c16a39',
        requestSignature:
          '+knEdlenTV+MooRqlFsZRPWW8s9pcjKwB40fY5o0GJmAi2RPZtaVGRTqgApTIn2zPBTE4GQlmPD7uxcczHDjAg==',
        grantSignature:
          'eKzcOWMEVetybkuiVK2u18B9en5pywohn2Hn25/VOVTMrIsKSCW4xXpqwipfqvgvi62WtUt6SA9bCEB5Ngcyiw==',
      };

      const stub = sinon.stub().resolves({
        isPrimary: false,
        authorisations: [networkAuth],
      });
      TestUtils.stubWindow('lokiFileServerAPI', {
        getUserDeviceMapping: stub,
      });

      const authorisations = await MultiDeviceProtocol.fetchPairingAuthorisations(
        TestUtils.generateFakePubKey()
      );
      expect(authorisations.length).to.equal(1);

      const {
        primaryDevicePubKey,
        secondaryDevicePubKey,
        requestSignature,
        grantSignature,
      } = authorisations[0];
      expect(primaryDevicePubKey).to.equal(networkAuth.primaryDevicePubKey);
      expect(secondaryDevicePubKey).to.equal(networkAuth.secondaryDevicePubKey);
      expect(StringUtils.decode(requestSignature, 'base64')).to.equal(
        networkAuth.requestSignature
      );
      expect(grantSignature).to.not.equal(
        undefined,
        'Grant signature should not be undefined.'
      );
      // tslint:disable-next-line: no-non-null-assertion
      expect(StringUtils.decode(grantSignature!, 'base64')).to.equal(
        networkAuth.grantSignature
      );
    });

    it('should not return invalid authorisations', async () => {
      const networkAuth = {
        primaryDevicePubKey:
          '05caa6310a490415df45f8f4ad1b3655ad7a11e722257887a30cf71601d679720b',
        secondaryDevicePubKey:
          '051296b9588641eea268d60ad6636eecb53a95150e91c0531a00203e01a2c16a39',
        requestSignature:
          '+knEdlenTV+MooRqlFsZRPWW8s9pcjKwB40fY5o0GJmAi2RPZtaVGRTqgApTIn2zPBTE4GQlmPD7uxcczHDjAg==',
        grantSignature:
          'eKzcOWMEVetybkuiVK2u18B9en5pywohn2Hn25/VOVTMrIsKSCW4xXpqwipfqvgvi62WtUt6SA9bCEB5Ngcyiw==',
      };

      const stub = sinon.stub().resolves({
        isPrimary: false,
        authorisations: [networkAuth],
      });
      TestUtils.stubWindow('lokiFileServerAPI', {
        getUserDeviceMapping: stub,
      });

      verifyAuthorisationStub.resolves(false);

      const authorisations = await MultiDeviceProtocol.fetchPairingAuthorisations(
        TestUtils.generateFakePubKey()
      );
      expect(verifyAuthorisationStub.callCount).to.equal(1);
      expect(authorisations.length).to.equal(0);
    });

    it('should handle incorrect pairing authorisations from the file server', async () => {
      const invalidAuth = {
        primaryDevicePubKey:
          '05caa6310a490415df45f8f4ad1b3655ad7a11e722257887a30cf71601d679720b',
        secondaryDevicePubKey:
          '051296b9588641eea268d60ad6636eecb53a95150e91c0531a00203e01a2c16a39',
        requestSignatures:
          '+knEdlenTV+MooRqlFsZRPWW8s9pcjKwB40fY5o0GJmAi2RPZtaVGRTqgApTIn2zPBTE4GQlmPD7uxcczHDjAg==',
      };

      const stub = sinon.stub().resolves({
        isPrimary: false,
        authorisations: [invalidAuth],
      });
      TestUtils.stubWindow('lokiFileServerAPI', {
        getUserDeviceMapping: stub,
      });
      const authorisations = await MultiDeviceProtocol.fetchPairingAuthorisations(
        TestUtils.generateFakePubKey()
      );
      expect(authorisations.length).to.equal(0);
    });

    it('should return empty array if mapping is null', async () => {
      const stub = sinon.stub().resolves(null);
      TestUtils.stubWindow('lokiFileServerAPI', {
        getUserDeviceMapping: stub,
      });

      const authorisations = await MultiDeviceProtocol.fetchPairingAuthorisations(
        TestUtils.generateFakePubKey()
      );
      expect(authorisations.length).to.equal(0);
    });

    it('should return empty array if authorisations in mapping are null', async () => {
      const stub = sinon.stub().resolves({
        isPrimary: false,
        authorisations: null,
      });
      TestUtils.stubWindow('lokiFileServerAPI', {
        getUserDeviceMapping: stub,
      });

      const authorisations = await MultiDeviceProtocol.fetchPairingAuthorisations(
        TestUtils.generateFakePubKey()
      );
      expect(authorisations.length).to.equal(0);
    });
  });

  describe('fetchPairingAuthorisationIfNeeded', () => {
    beforeEach(() => {
      TestUtils.stubWindow('libloki', {
        crypto: {
          verifyAuthorisation: async () => true,
        } as any,
      });
    });

    let fetchPairingAuthorisationStub: sinon.SinonStub<
      [PubKey],
      Promise<Array<PairingAuthorisation>>
    >;
    let currentDevice: PubKey;
    let device: PubKey;
    beforeEach(() => {
      MultiDeviceProtocol.resetFetchCache();

      fetchPairingAuthorisationStub = sandbox
        .stub(MultiDeviceProtocol, 'fetchPairingAuthorisations')
        .resolves([]);
      currentDevice = TestUtils.generateFakePubKey();
      device = TestUtils.generateFakePubKey();
      sandbox
        .stub(UserUtil, 'getCurrentDevicePubKey')
        .resolves(currentDevice.key);
    });

    it('should not fetch authorisations for our devices', async () => {
      const otherDevices = TestUtils.generateFakePubKeys(2);
      const authorisations = generateFakeAuthorisations(
        currentDevice,
        otherDevices
      );
      sandbox
        .stub(MultiDeviceProtocol, 'getPairingAuthorisations')
        .resolves(authorisations);

      for (const ourDevice of [currentDevice, ...otherDevices]) {
        // Ensure cache is not getting in our way
        MultiDeviceProtocol.resetFetchCache();

        await MultiDeviceProtocol.fetchPairingAuthorisationsIfNeeded(ourDevice);
        expect(fetchPairingAuthorisationStub.called).to.equal(
          false,
          'Pairing should not be fetched from the server'
        );
      }
    });

    it('should fetch if it has not fetched before', async () => {
      await MultiDeviceProtocol.fetchPairingAuthorisationsIfNeeded(device);
      expect(fetchPairingAuthorisationStub.calledWith(device)).to.equal(
        true,
        'Device does not match'
      );
      expect(fetchPairingAuthorisationStub.called).to.equal(
        true,
        'Pairing should be fetched from the server'
      );
    });

    it('should not fetch if the refresh delay has not been met', async () => {
      await MultiDeviceProtocol.fetchPairingAuthorisationsIfNeeded(device);
      await TestUtils.timeout(100);
      await MultiDeviceProtocol.fetchPairingAuthorisationsIfNeeded(device);
      expect(fetchPairingAuthorisationStub.callCount).to.equal(
        1,
        'Pairing should only be fetched once every refresh delay'
      );
    });

    it('should fetch again if time since last fetch is more than refresh delay', async () => {
      const clock = sandbox.useFakeTimers();
      await MultiDeviceProtocol.fetchPairingAuthorisationsIfNeeded(device);
      clock.tick(MultiDeviceProtocol.refreshDelay + 10);
      await MultiDeviceProtocol.fetchPairingAuthorisationsIfNeeded(device);
      expect(fetchPairingAuthorisationStub.callCount).to.equal(2);
    });

    it('should fetch again if something went wrong while fetching', async () => {
      fetchPairingAuthorisationStub.throws(new Error('42'));
      await MultiDeviceProtocol.fetchPairingAuthorisationsIfNeeded(device);
      await TestUtils.timeout(100);
      await MultiDeviceProtocol.fetchPairingAuthorisationsIfNeeded(device);
      expect(fetchPairingAuthorisationStub.callCount).to.equal(2);
    });

    it('should fetch only once if called rapidly', async () => {
      fetchPairingAuthorisationStub.callsFake(async () => {
        await TestUtils.timeout(200);
        return [];
      });

      void MultiDeviceProtocol.fetchPairingAuthorisationsIfNeeded(device);
      await TestUtils.timeout(10);
      void MultiDeviceProtocol.fetchPairingAuthorisationsIfNeeded(device);
      await TestUtils.timeout(200);
      expect(fetchPairingAuthorisationStub.callCount).to.equal(1);
    });

    it('should save the fetched authorisations', async () => {
      const saveStub = sandbox
        .stub(MultiDeviceProtocol, 'savePairingAuthorisation')
        .resolves();
      const authorisations = generateFakeAuthorisations(
        device,
        TestUtils.generateFakePubKeys(3)
      );
      fetchPairingAuthorisationStub.resolves(authorisations);
      await MultiDeviceProtocol.fetchPairingAuthorisationsIfNeeded(device);
      expect(saveStub.callCount).to.equal(authorisations.length);
    });
  });

  describe('getAllDevices', () => {
    it('should return all devices', async () => {
      const primary = TestUtils.generateFakePubKey();
      const otherDevices = TestUtils.generateFakePubKeys(2);
      const authorisations = generateFakeAuthorisations(primary, otherDevices);
      sandbox
        .stub(MultiDeviceProtocol, 'getPairingAuthorisations')
        .resolves(authorisations);

      const devices = [primary, ...otherDevices];
      for (const device of devices) {
        const allDevices = await MultiDeviceProtocol.getAllDevices(device);
        const allDevicePubKeys = allDevices.map(p => p.key);
        expect(allDevicePubKeys).to.have.same.members(devices.map(d => d.key));
      }
    });

    it('should return the passed in user device if no pairing authorisations are found', async () => {
      const pubKey = TestUtils.generateFakePubKey();
      sandbox
        .stub(MultiDeviceProtocol, 'getPairingAuthorisations')
        .resolves([]);
      const allDevices = await MultiDeviceProtocol.getAllDevices(pubKey);
      expect(allDevices).to.have.length(1);
      expect(allDevices[0].key).to.equal(pubKey.key);
    });
  });

  describe('getPrimaryDevice', () => {
    it('should return the primary device', async () => {
      const primary = TestUtils.generateFakePubKey();
      const otherDevices = TestUtils.generateFakePubKeys(2);
      const authorisations = generateFakeAuthorisations(primary, otherDevices);
      sandbox
        .stub(MultiDeviceProtocol, 'getPairingAuthorisations')
        .resolves(authorisations);

      const devices = [primary, ...otherDevices];
      for (const device of devices) {
        const actual = await MultiDeviceProtocol.getPrimaryDevice(device);
        expect(actual.key).to.equal(primary.key);
      }
    });
  });

  describe('getSecondaryDevices', () => {
    it('should return the secondary devices', async () => {
      const primary = TestUtils.generateFakePubKey();
      const otherDevices = TestUtils.generateFakePubKeys(2);
      const authorisations = generateFakeAuthorisations(primary, otherDevices);
      sandbox
        .stub(MultiDeviceProtocol, 'getPairingAuthorisations')
        .resolves(authorisations);

      const devices = [primary, ...otherDevices];
      for (const device of devices) {
        const secondaryDevices = await MultiDeviceProtocol.getSecondaryDevices(
          device
        );
        const pubKeys = secondaryDevices.map(p => p.key);
        expect(pubKeys).to.have.same.members(otherDevices.map(d => d.key));
      }
    });
  });
});

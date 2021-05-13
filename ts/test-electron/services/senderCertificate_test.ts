// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// We allow `any`s because it's arduous to set up "real" WebAPIs and storages.
/* eslint-disable @typescript-eslint/no-explicit-any */

import * as fs from 'fs';
import * as path from 'path';
import { assert } from 'chai';
import * as sinon from 'sinon';
import { v4 as uuid } from 'uuid';
import { arrayBufferToBase64 } from '../../Crypto';
import { SenderCertificateClass } from '../../textsecure';
import { SenderCertificateMode } from '../../textsecure/OutgoingMessage';

import { SenderCertificateService } from '../../services/senderCertificate';

describe('SenderCertificateService', () => {
  const FIFTEEN_MINUTES = 15 * 60 * 1000;

  let fakeValidCertificate: SenderCertificateClass;
  let fakeValidCertificateExpiry: number;
  let fakeServer: any;
  let fakeWebApi: typeof window.WebAPI;
  let fakeNavigator: { onLine: boolean };
  let fakeWindow: EventTarget;
  let fakeStorage: any;
  let SenderCertificate: typeof SenderCertificateClass;

  function initializeTestService(): SenderCertificateService {
    const result = new SenderCertificateService();
    result.initialize({
      SenderCertificate,
      WebAPI: fakeWebApi,
      navigator: fakeNavigator,
      onlineEventTarget: fakeWindow,
      storage: fakeStorage,
    });
    return result;
  }

  before(done => {
    const protoPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'protos',
      'UnidentifiedDelivery.proto'
    );
    fs.readFile(protoPath, 'utf8', (err, proto) => {
      if (err) {
        done(err);
        return;
      }
      ({ SenderCertificate } = global.window.dcodeIO.ProtoBuf.loadProto(
        proto
      ).build('signalservice'));
      done();
    });
  });

  beforeEach(() => {
    fakeValidCertificate = new SenderCertificate();
    fakeValidCertificateExpiry = Date.now() + 604800000;
    const certificate = new SenderCertificate.Certificate();
    certificate.expires = global.window.dcodeIO.Long.fromNumber(
      fakeValidCertificateExpiry
    );
    fakeValidCertificate.certificate = certificate.toArrayBuffer();

    fakeServer = {
      getSenderCertificate: sinon.stub().resolves({
        certificate: arrayBufferToBase64(fakeValidCertificate.toArrayBuffer()),
      }),
    };
    fakeWebApi = { connect: sinon.stub().returns(fakeServer) };

    fakeNavigator = { onLine: true };

    fakeWindow = {
      addEventListener: sinon.stub(),
      dispatchEvent: sinon.stub(),
      removeEventListener: sinon.stub(),
    };

    fakeStorage = {
      get: sinon.stub(),
      put: sinon.stub().resolves(),
      remove: sinon.stub().resolves(),
    };
    fakeStorage.get.withArgs('uuid_id').returns(`${uuid()}.2`);
    fakeStorage.get.withArgs('password').returns('abc123');
  });

  describe('get', () => {
    it('returns valid yes-E164 certificates from storage if they exist', async () => {
      const cert = {
        expires: Date.now() + 123456,
        serialized: new ArrayBuffer(2),
      };
      fakeStorage.get.withArgs('senderCertificate').returns(cert);

      const service = initializeTestService();

      assert.strictEqual(
        await service.get(SenderCertificateMode.WithE164),
        cert
      );

      sinon.assert.notCalled(fakeStorage.put);
    });

    it('returns valid no-E164 certificates from storage if they exist', async () => {
      const cert = {
        expires: Date.now() + 123456,
        serialized: new ArrayBuffer(2),
      };
      fakeStorage.get.withArgs('senderCertificateNoE164').returns(cert);

      const service = initializeTestService();

      assert.strictEqual(
        await service.get(SenderCertificateMode.WithoutE164),
        cert
      );

      sinon.assert.notCalled(fakeStorage.put);
    });

    it('returns and stores a newly-fetched yes-E164 certificate if none was in storage', async () => {
      const service = initializeTestService();

      assert.deepEqual(await service.get(SenderCertificateMode.WithE164), {
        expires: fakeValidCertificateExpiry - FIFTEEN_MINUTES,
        serialized: fakeValidCertificate.toArrayBuffer(),
      });

      sinon.assert.calledWithMatch(fakeStorage.put, 'senderCertificate', {
        expires: fakeValidCertificateExpiry - FIFTEEN_MINUTES,
        serialized: fakeValidCertificate.toArrayBuffer(),
      });

      sinon.assert.calledWith(fakeServer.getSenderCertificate, false);
    });

    it('returns and stores a newly-fetched no-E164 certificate if none was in storage', async () => {
      const service = initializeTestService();

      assert.deepEqual(await service.get(SenderCertificateMode.WithoutE164), {
        expires: fakeValidCertificateExpiry - FIFTEEN_MINUTES,
        serialized: fakeValidCertificate.toArrayBuffer(),
      });

      sinon.assert.calledWithMatch(fakeStorage.put, 'senderCertificateNoE164', {
        expires: fakeValidCertificateExpiry - FIFTEEN_MINUTES,
        serialized: fakeValidCertificate.toArrayBuffer(),
      });

      sinon.assert.calledWith(fakeServer.getSenderCertificate, true);
    });

    it('fetches new certificates if the value in storage has already expired', async () => {
      const service = initializeTestService();

      fakeStorage.get.withArgs('senderCertificate').returns({
        expires: Date.now() - 1000,
        serialized: new ArrayBuffer(2),
      });

      await service.get(SenderCertificateMode.WithE164);

      sinon.assert.called(fakeServer.getSenderCertificate);
    });

    it('fetches new certificates if the value in storage is invalid', async () => {
      const service = initializeTestService();

      fakeStorage.get.withArgs('senderCertificate').returns({
        serialized: 'not an arraybuffer',
      });

      await service.get(SenderCertificateMode.WithE164);

      sinon.assert.called(fakeServer.getSenderCertificate);
    });

    it('only hits the server once per certificate type when requesting many times', async () => {
      const service = initializeTestService();

      await Promise.all([
        service.get(SenderCertificateMode.WithE164),
        service.get(SenderCertificateMode.WithoutE164),
        service.get(SenderCertificateMode.WithE164),
        service.get(SenderCertificateMode.WithoutE164),
        service.get(SenderCertificateMode.WithE164),
        service.get(SenderCertificateMode.WithoutE164),
        service.get(SenderCertificateMode.WithE164),
        service.get(SenderCertificateMode.WithoutE164),
      ]);

      sinon.assert.calledTwice(fakeServer.getSenderCertificate);
    });

    it('hits the server again after a request has completed', async () => {
      const service = initializeTestService();

      await service.get(SenderCertificateMode.WithE164);
      sinon.assert.calledOnce(fakeServer.getSenderCertificate);
      await service.get(SenderCertificateMode.WithE164);

      sinon.assert.calledTwice(fakeServer.getSenderCertificate);
    });

    it('returns undefined if the request to the server fails', async () => {
      const service = initializeTestService();

      fakeServer.getSenderCertificate.rejects(new Error('uh oh'));

      assert.isUndefined(await service.get(SenderCertificateMode.WithE164));
    });

    it('returns undefined if the server returns an already-expired certificate', async () => {
      const service = initializeTestService();

      const expiredCertificate = new SenderCertificate();
      const certificate = new SenderCertificate.Certificate();
      certificate.expires = global.window.dcodeIO.Long.fromNumber(
        Date.now() - 1000
      );
      expiredCertificate.certificate = certificate.toArrayBuffer();
      fakeServer.getSenderCertificate.resolves({
        certificate: arrayBufferToBase64(expiredCertificate.toArrayBuffer()),
      });

      assert.isUndefined(await service.get(SenderCertificateMode.WithE164));
    });
  });
});

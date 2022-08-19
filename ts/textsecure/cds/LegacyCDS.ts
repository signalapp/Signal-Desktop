// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable no-bitwise */

import pProps from 'p-props';
import { compact } from 'lodash';
import Long from 'long';
import { createVerify } from 'crypto';
import { pki } from 'node-forge';

import {
  constantTimeEqual,
  decryptAesGcm,
  deriveSecrets,
  encryptCdsDiscoveryRequest,
  splitUuids,
} from '../../Crypto';
import { calculateAgreement, generateKeyPair } from '../../Curve';
import * as Bytes from '../../Bytes';
import { UUID } from '../../types/UUID';
import type { CDSBaseOptionsType } from './CDSBase';
import { CDSBase } from './CDSBase';
import type {
  CDSRequestOptionsType,
  CDSResponseType,
  CDSAuthType,
  CDSResponseEntryType,
} from './Types.d';

export type LegacyCDSPutAttestationResponseType = Readonly<{
  attestations: Record<
    string,
    {
      ciphertext: string;
      iv: string;
      quote: string;
      serverEphemeralPublic: string;
      serverStaticPublic: string;
      signature: string;
      signatureBody: string;
      tag: string;
      certificates: string;
    }
  >;
}>;

export type LegacyCDSPutAttestationResultType = Readonly<{
  cookie?: string;
  responseBody: LegacyCDSPutAttestationResponseType;
}>;

export type LegacyCDSDiscoveryResponseType = Readonly<{
  requestId: Uint8Array;
  iv: Uint8Array;
  data: Uint8Array;
  mac: Uint8Array;
}>;

export type LegacyCDSOptionsType = Readonly<{
  directoryEnclaveId: string;
  directoryTrustAnchor: string;

  putAttestation: (
    auth: CDSAuthType,
    publicKey: Uint8Array
  ) => Promise<LegacyCDSPutAttestationResultType>;
  fetchDiscoveryData: (
    auth: CDSAuthType,
    data: Record<string, unknown>,
    cookie?: string
  ) => Promise<LegacyCDSDiscoveryResponseType>;
}> &
  CDSBaseOptionsType;

type AttestationMapType = Readonly<{
  cookie?: string;
  attestations: Record<
    string,
    Readonly<{
      clientKey: Uint8Array;
      serverKey: Uint8Array;
      requestId: Uint8Array;
    }>
  >;
}>;

type SgxConstantsType = {
  SGX_FLAGS_INITTED: Long;
  SGX_FLAGS_DEBUG: Long;
  SGX_FLAGS_MODE64BIT: Long;
  SGX_FLAGS_PROVISION_KEY: Long;
  SGX_FLAGS_EINITTOKEN_KEY: Long;
  SGX_FLAGS_RESERVED: Long;
  SGX_XFRM_LEGACY: Long;
  SGX_XFRM_AVX: Long;
  SGX_XFRM_RESERVED: Long;
};

let sgxConstantCache: SgxConstantsType | null = null;

function makeLong(value: string): Long {
  return Long.fromString(value);
}
function getSgxConstants() {
  if (sgxConstantCache) {
    return sgxConstantCache;
  }

  sgxConstantCache = {
    SGX_FLAGS_INITTED: makeLong('x0000000000000001L'),
    SGX_FLAGS_DEBUG: makeLong('x0000000000000002L'),
    SGX_FLAGS_MODE64BIT: makeLong('x0000000000000004L'),
    SGX_FLAGS_PROVISION_KEY: makeLong('x0000000000000004L'),
    SGX_FLAGS_EINITTOKEN_KEY: makeLong('x0000000000000004L'),
    SGX_FLAGS_RESERVED: makeLong('xFFFFFFFFFFFFFFC8L'),
    SGX_XFRM_LEGACY: makeLong('x0000000000000003L'),
    SGX_XFRM_AVX: makeLong('x0000000000000006L'),
    SGX_XFRM_RESERVED: makeLong('xFFFFFFFFFFFFFFF8L'),
  };

  return sgxConstantCache;
}

export class LegacyCDS extends CDSBase<LegacyCDSOptionsType> {
  public override async request({
    e164s,
  }: CDSRequestOptionsType): Promise<CDSResponseType> {
    const directoryAuth = await this.getAuth();
    const attestationResult = await this.putAttestation(directoryAuth);

    // Encrypt data for discovery
    const data = await encryptCdsDiscoveryRequest(
      attestationResult.attestations,
      e164s
    );
    const { cookie } = attestationResult;

    // Send discovery request
    const discoveryResponse = await this.options.fetchDiscoveryData(
      directoryAuth,
      data,
      cookie
    );

    const returnedAttestation = Object.values(
      attestationResult.attestations
    ).find(at => constantTimeEqual(at.requestId, discoveryResponse.requestId));
    if (!returnedAttestation) {
      throw new Error('No known attestations returned from CDS');
    }

    // Decrypt discovery response
    const decryptedDiscoveryData = decryptAesGcm(
      returnedAttestation.serverKey,
      discoveryResponse.iv,
      Bytes.concatenate([discoveryResponse.data, discoveryResponse.mac])
    );

    // Process and return result
    const uuids = splitUuids(decryptedDiscoveryData);

    if (uuids.length !== e164s.length) {
      throw new Error(
        'Returned set of UUIDs did not match returned set of e164s!'
      );
    }

    const result = new Map<string, CDSResponseEntryType>();

    for (const [i, e164] of e164s.entries()) {
      const uuid = uuids[i];
      result.set(e164, {
        aci: uuid ? UUID.cast(uuid) : undefined,
        pni: undefined,
      });
    }

    return result;
  }

  //
  // Private
  //

  private async putAttestation(auth: CDSAuthType): Promise<AttestationMapType> {
    const { privKey, pubKey } = generateKeyPair();
    // Remove first "key type" byte from public key
    const slicedPubKey = pubKey.slice(1);
    // Do request
    const { cookie, responseBody } = await this.options.putAttestation(
      auth,
      slicedPubKey
    );

    const attestationsLength = Object.keys(responseBody.attestations).length;
    if (attestationsLength > 3) {
      throw new Error(
        'Got more than three attestations from the Contact Discovery Service'
      );
    }
    if (attestationsLength < 1) {
      throw new Error('Got no attestations from the Contact Discovery Service');
    }

    // Decode response
    return {
      cookie,
      attestations: await pProps(
        responseBody.attestations,
        async attestation => {
          const decoded = {
            ...attestation,
            ciphertext: Bytes.fromBase64(attestation.ciphertext),
            iv: Bytes.fromBase64(attestation.iv),
            quote: Bytes.fromBase64(attestation.quote),
            serverEphemeralPublic: Bytes.fromBase64(
              attestation.serverEphemeralPublic
            ),
            serverStaticPublic: Bytes.fromBase64(
              attestation.serverStaticPublic
            ),
            signature: Bytes.fromBase64(attestation.signature),
            tag: Bytes.fromBase64(attestation.tag),
          };

          // Validate response
          this.validateAttestationQuote(decoded);
          validateAttestationSignatureBody(
            JSON.parse(decoded.signatureBody),
            attestation.quote
          );
          await this.validateAttestationSignature(
            decoded.signature,
            decoded.signatureBody,
            decoded.certificates
          );

          // Derive key
          const ephemeralToEphemeral = calculateAgreement(
            decoded.serverEphemeralPublic,
            privKey
          );
          const ephemeralToStatic = calculateAgreement(
            decoded.serverStaticPublic,
            privKey
          );
          const masterSecret = Bytes.concatenate([
            ephemeralToEphemeral,
            ephemeralToStatic,
          ]);
          const publicKeys = Bytes.concatenate([
            slicedPubKey,
            decoded.serverEphemeralPublic,
            decoded.serverStaticPublic,
          ]);
          const [clientKey, serverKey] = deriveSecrets(
            masterSecret,
            publicKeys,
            new Uint8Array(0)
          );

          // Decrypt ciphertext into requestId
          const requestId = decryptAesGcm(
            serverKey,
            decoded.iv,
            Bytes.concatenate([decoded.ciphertext, decoded.tag])
          );

          return {
            clientKey,
            serverKey,
            requestId,
          };
        }
      ),
    };
  }

  private async validateAttestationSignature(
    signature: Uint8Array,
    signatureBody: string,
    certificates: string
  ) {
    const CERT_PREFIX = '-----BEGIN CERTIFICATE-----';
    const pem = compact(
      certificates.split(CERT_PREFIX).map(match => {
        if (!match) {
          return null;
        }

        return `${CERT_PREFIX}${match}`;
      })
    );
    if (pem.length < 2) {
      throw new Error(
        `validateAttestationSignature: Expect two or more entries; got ${pem.length}`
      );
    }

    const verify = createVerify('RSA-SHA256');
    verify.update(Buffer.from(Bytes.fromString(signatureBody)));
    const isValid = verify.verify(pem[0], Buffer.from(signature));
    if (!isValid) {
      throw new Error('Validation of signature across signatureBody failed!');
    }

    const caStore = pki.createCaStore([this.options.directoryTrustAnchor]);
    const chain = compact(pem.map(cert => pki.certificateFromPem(cert)));
    const isChainValid = pki.verifyCertificateChain(caStore, chain);
    if (!isChainValid) {
      throw new Error('Validation of certificate chain failed!');
    }

    const leafCert = chain[0];
    const fieldCN = leafCert.subject.getField('CN');
    if (!fieldCN || fieldCN.value !== 'Intel SGX Attestation Report Signing') {
      throw new Error('Leaf cert CN field had unexpected value');
    }
    const fieldO = leafCert.subject.getField('O');
    if (!fieldO || fieldO.value !== 'Intel Corporation') {
      throw new Error('Leaf cert O field had unexpected value');
    }
    const fieldL = leafCert.subject.getField('L');
    if (!fieldL || fieldL.value !== 'Santa Clara') {
      throw new Error('Leaf cert L field had unexpected value');
    }
    const fieldST = leafCert.subject.getField('ST');
    if (!fieldST || fieldST.value !== 'CA') {
      throw new Error('Leaf cert ST field had unexpected value');
    }
    const fieldC = leafCert.subject.getField('C');
    if (!fieldC || fieldC.value !== 'US') {
      throw new Error('Leaf cert C field had unexpected value');
    }
  }

  private validateAttestationQuote({
    serverStaticPublic,
    quote: quoteBytes,
  }: {
    serverStaticPublic: Uint8Array;
    quote: Uint8Array;
  }): void {
    const SGX_CONSTANTS = getSgxConstants();
    const quote = Buffer.from(quoteBytes);

    const quoteVersion = quote.readInt16LE(0) & 0xffff;
    if (quoteVersion < 0 || quoteVersion > 2) {
      throw new Error(`Unknown version ${quoteVersion}`);
    }

    const miscSelect = quote.slice(64, 64 + 4);
    if (!miscSelect.every(byte => byte === 0)) {
      throw new Error('Quote miscSelect invalid!');
    }

    const reserved1 = quote.slice(68, 68 + 28);
    if (!reserved1.every(byte => byte === 0)) {
      throw new Error('Quote reserved1 invalid!');
    }

    const flags = Long.fromBytesLE(
      Array.from(quote.slice(96, 96 + 8).values())
    );
    if (
      flags.and(SGX_CONSTANTS.SGX_FLAGS_RESERVED).notEquals(0) ||
      flags.and(SGX_CONSTANTS.SGX_FLAGS_INITTED).equals(0) ||
      flags.and(SGX_CONSTANTS.SGX_FLAGS_MODE64BIT).equals(0)
    ) {
      throw new Error(`Quote flags invalid ${flags.toString()}`);
    }

    const xfrm = Long.fromBytesLE(
      Array.from(quote.slice(104, 104 + 8).values())
    );
    if (xfrm.and(SGX_CONSTANTS.SGX_XFRM_RESERVED).notEquals(0)) {
      throw new Error(`Quote xfrm invalid ${xfrm}`);
    }

    const mrenclave = quote.slice(112, 112 + 32);
    const enclaveIdBytes = Bytes.fromHex(this.options.directoryEnclaveId);
    if (mrenclave.compare(enclaveIdBytes) !== 0) {
      throw new Error('Quote mrenclave invalid!');
    }

    const reserved2 = quote.slice(144, 144 + 32);
    if (!reserved2.every(byte => byte === 0)) {
      throw new Error('Quote reserved2 invalid!');
    }

    const reportData = quote.slice(368, 368 + 64);
    const serverStaticPublicBytes = serverStaticPublic;
    if (
      !reportData.every((byte, index) => {
        if (index >= 32) {
          return byte === 0;
        }
        return byte === serverStaticPublicBytes[index];
      })
    ) {
      throw new Error('Quote report_data invalid!');
    }

    const reserved3 = quote.slice(208, 208 + 96);
    if (!reserved3.every(byte => byte === 0)) {
      throw new Error('Quote reserved3 invalid!');
    }

    const reserved4 = quote.slice(308, 308 + 60);
    if (!reserved4.every(byte => byte === 0)) {
      throw new Error('Quote reserved4 invalid!');
    }

    const signatureLength = quote.readInt32LE(432) >>> 0;
    if (signatureLength !== quote.byteLength - 436) {
      throw new Error(`Bad signatureLength ${signatureLength}`);
    }

    // const signature = quote.slice(436, 436 + signatureLength);
  }
}

function validateAttestationSignatureBody(
  signatureBody: {
    timestamp: string;
    version: number;
    isvEnclaveQuoteBody: string;
    isvEnclaveQuoteStatus: string;
    advisoryIDs: ReadonlyArray<string>;
  },
  encodedQuote: string
) {
  // Parse timestamp as UTC
  const { timestamp } = signatureBody;
  const utcTimestamp = timestamp.endsWith('Z') ? timestamp : `${timestamp}Z`;
  const signatureTime = new Date(utcTimestamp).getTime();

  const now = Date.now();
  if (signatureBody.version !== 4) {
    throw new Error('Attestation signature invalid version!');
  }
  if (!encodedQuote.startsWith(signatureBody.isvEnclaveQuoteBody)) {
    throw new Error('Attestion signature mismatches quote!');
  }
  if (signatureBody.isvEnclaveQuoteStatus !== 'SW_HARDENING_NEEDED') {
    throw new Error('Attestation signature status not "SW_HARDENING_NEEDED"!');
  }
  if (
    signatureBody.advisoryIDs.length !== 1 ||
    signatureBody.advisoryIDs[0] !== 'INTEL-SA-00334'
  ) {
    throw new Error('Attestation advisory ids are incorrect');
  }
  if (signatureTime < now - 24 * 60 * 60 * 1000) {
    throw new Error('Attestation signature timestamp older than 24 hours!');
  }
}

// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { assert } from 'chai';
import type { ParsedSignalRoute } from '../../util/signalRoutes';
import {
  isSignalRoute,
  parseSignalRoute,
  toSignalRouteAppUrl,
  toSignalRouteUrl,
  toSignalRouteWebUrl,
} from '../../util/signalRoutes';

describe('signalRoutes', () => {
  type CheckConfig = {
    hasAppUrl: boolean;
    hasWebUrl: boolean;
    isRoute: boolean;
  };

  function createCheck(options: Partial<CheckConfig> = {}) {
    const config: CheckConfig = {
      hasAppUrl: true,
      hasWebUrl: true,
      isRoute: true,
      ...options,
    };
    // Different than `isRoute` because of normalization
    const hasRouteUrl = config.hasAppUrl || config.hasWebUrl;
    return function check(input: string, expected: ParsedSignalRoute | null) {
      const url = new URL(input);
      assert.deepEqual(parseSignalRoute(url), expected);
      assert.deepEqual(isSignalRoute(url), config.isRoute);
      assert.deepEqual(toSignalRouteUrl(url) != null, hasRouteUrl);
      assert.deepEqual(toSignalRouteAppUrl(url) != null, config.hasAppUrl);
      assert.deepEqual(toSignalRouteWebUrl(url) != null, config.hasWebUrl);
    };
  }

  const foo = 'FoO.bAr-BaZ_123/456';
  const fooNoSlash = 'FoO.bAr-BaZ_123';

  it('nonsense', () => {
    const check = createCheck({
      isRoute: false,
      hasAppUrl: false,
      hasWebUrl: false,
    });
    // Charles Entertainment Cheese, what are you doing here?
    check('https://www.chuckecheese.com/#p/+1234567890', null);
    // Non-route signal urls
    check('https://signal.me', null);
    check('sgnl://signal.me/#p', null);
    check('sgnl://signal.me/#p/', null);
    check('sgnl://signal.me/p/+1234567890', null);
    check('https://signal.me/?p/+1234567890', null);
  });

  it('normalize', () => {
    const check = createCheck({ isRoute: false, hasAppUrl: true });
    check('http://username:password@signal.me:8888/#p/+1234567890', null);
  });

  it('contactByPhoneNumber', () => {
    const result: ParsedSignalRoute = {
      key: 'contactByPhoneNumber',
      args: { phoneNumber: '+1234567890' },
    };
    const check = createCheck();
    check('https://signal.me/#p/+1234567890', result);
    check('https://signal.me#p/+1234567890', result);
    check('sgnl://signal.me/#p/+1234567890', result);
    check('sgnl://signal.me#p/+1234567890', result);
  });

  it('contactByEncryptedUsername', () => {
    const result: ParsedSignalRoute = {
      key: 'contactByEncryptedUsername',
      args: { encryptedUsername: foo },
    };
    const check = createCheck();
    check(`https://signal.me/#eu/${foo}`, result);
    check(`https://signal.me#eu/${foo}`, result);
    check(`sgnl://signal.me/#eu/${foo}`, result);
    check(`sgnl://signal.me#eu/${foo}`, result);
  });

  it('groupInvites', () => {
    const result: ParsedSignalRoute = {
      key: 'groupInvites',
      args: { inviteCode: fooNoSlash },
    };
    const check = createCheck();
    check(`https://signal.group/#${fooNoSlash}`, result);
    check(`https://signal.group#${fooNoSlash}`, result);
    check(`sgnl://signal.group/#${fooNoSlash}`, result);
    check(`sgnl://signal.group#${fooNoSlash}`, result);
    check(`sgnl://joingroup/#${fooNoSlash}`, result);
    check(`sgnl://joingroup#${fooNoSlash}`, result);
  });

  it('linkDevice without capabilities', () => {
    const result: ParsedSignalRoute = {
      key: 'linkDevice',
      args: { uuid: foo, pubKey: foo, capabilities: [] },
    };
    const check = createCheck({ hasWebUrl: false });
    check(`sgnl://linkdevice/?uuid=${foo}&pub_key=${foo}`, result);
    check(`sgnl://linkdevice?uuid=${foo}&pub_key=${foo}`, result);
  });

  it('linkDevice with one capability', () => {
    const result: ParsedSignalRoute = {
      key: 'linkDevice',
      args: { uuid: foo, pubKey: foo, capabilities: ['backup'] },
    };
    const check = createCheck({ hasWebUrl: false });
    check(
      `sgnl://linkdevice/?uuid=${foo}&pub_key=${foo}&capabilities=backup`,
      result
    );
  });

  it('linkDevice with multiple capabilities', () => {
    const result: ParsedSignalRoute = {
      key: 'linkDevice',
      args: { uuid: foo, pubKey: foo, capabilities: ['a', 'b'] },
    };
    const check = createCheck({ hasWebUrl: false });
    check(
      `sgnl://linkdevice/?uuid=${foo}&pub_key=${foo}&capabilities=a%2Cb`,
      result
    );
  });

  it('captcha', () => {
    const captchaId =
      'signal-hcaptcha.Foo-bAr_baz.challenge.fOo-bAR_baZ.fOO-BaR_baz';
    const result: ParsedSignalRoute = {
      key: 'captcha',
      args: { captchaId },
    };
    const check = createCheck({ hasWebUrl: false });
    check(`signalcaptcha://${captchaId}`, result);
  });

  it('captcha with a trailing slash', () => {
    const captchaId =
      'signal-hcaptcha.Foo-bAr_baz.challenge.fOo-bAR_baZ.fOO-BaR_baz';
    const result: ParsedSignalRoute = {
      key: 'captcha',
      args: { captchaId },
    };
    const check = createCheck({ hasWebUrl: false });
    check(`signalcaptcha://${captchaId}/`, result);
  });

  it('linkCall', () => {
    const result: ParsedSignalRoute = {
      key: 'linkCall',
      args: { key: foo },
    };
    const check = createCheck();
    check(`https://signal.link/call/#key=${foo}`, result);
    check(`https://signal.link/call#key=${foo}`, result);
    check(`sgnl://signal.link/call/#key=${foo}`, result);
    check(`sgnl://signal.link/call#key=${foo}`, result);
  });

  it('artAddStickers', () => {
    const result: ParsedSignalRoute = {
      key: 'artAddStickers',
      args: { packId: foo, packKey: foo },
    };
    const check = createCheck();
    check(
      `https://signal.art/addstickers/#pack_id=${foo}&pack_key=${foo}`,
      result
    );
    check(
      `https://signal.art/addstickers#pack_id=${foo}&pack_key=${foo}`,
      result
    );
    check(`sgnl://addstickers/?pack_id=${foo}&pack_key=${foo}`, result);
    check(`sgnl://addstickers?pack_id=${foo}&pack_key=${foo}`, result);
  });

  it('showConversation', () => {
    const check = createCheck({ isRoute: true, hasWebUrl: false });
    const args1 = `token=${foo}`;
    const result1: ParsedSignalRoute = {
      key: 'showConversation',
      args: { token: foo },
    };
    check(`sgnl://show-conversation/?${args1}`, result1);
    check(`sgnl://show-conversation?${args1}`, result1);
  });

  it('startCallLobby', () => {
    const result: ParsedSignalRoute = {
      key: 'startCallLobby',
      args: { token: foo },
    };
    const check = createCheck({ isRoute: true, hasWebUrl: false });
    check(`sgnl://start-call-lobby/?token=${foo}`, result);
    check(`sgnl://start-call-lobby?token=${foo}`, result);
  });

  it('showWindow', () => {
    const result: ParsedSignalRoute = {
      key: 'showWindow',
      args: {},
    };
    const check = createCheck({ isRoute: true, hasWebUrl: false });
    check('sgnl://show-window/', result);
    check('sgnl://show-window', result);
  });

  it('cancelPresenting', () => {
    const result: ParsedSignalRoute = {
      key: 'cancelPresenting',
      args: {},
    };
    const check = createCheck({ isRoute: true, hasWebUrl: false });
    check('sgnl://cancel-presenting/', result);
    check('sgnl://cancel-presenting', result);
  });
});

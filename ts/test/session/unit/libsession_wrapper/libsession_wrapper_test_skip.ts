import { expect } from 'chai';

import { stringToUint8Array } from '../../../../session/utils/String';
import { from_hex, to_hex } from 'libsodium-wrappers-sumo';
import { concatUInt8Array } from '../../../../session/crypto';
import * as SessionUtilWrapper from 'session_util_wrapper';

// tslint:disable: chai-vague-errors no-unused-expression no-http-string no-octal-literal whitespace

describe('libsession_wrapper', () => {
  it('[config][user_profile][c]', () => {
    // Note: To run this test, you need to compile the libsession wrapper for node (and not for electron).
    // To do this, you can cd to the node_module/libsession_wrapper folder and do
    // yarn configure && yarn build
    // once that is done, you can rename this file and remove the _skip suffix so that test is run.

    // We have to disable it by filename as nodejs tries to load the module during the import step above, and fails as it is not compiled for nodejs but for electron.

    const edSecretKey = from_hex(
      '0123456789abcdef0123456789abcdef000000000000000000000000000000004cb76fdc6d32278e3f83dbf608360ecc6b65727934b85d2fb86862ff98c46ab7'
    );

    // Initialize a brand new, empty config because we have no dump data to deal with.
    const conf = new SessionUtilWrapper.UserConfigWrapper(edSecretKey, null);

    // We don't need to push anything, since this is an empty config
    expect(conf.needsPush()).to.be.eql(false);
    expect(conf.needsDump()).to.be.eql(false);

    // Since it's empty there shouldn't be a name.
    expect(conf.getName()).to.be.null;

    let pushResult = conf.push();

    expect(pushResult.seqno).to.be.eq(0);
    expect(pushResult.data.length).to.be.eq(256);

    expect(conf.encryptionDomain()).to.be.eq('UserProfile');
    expect(conf.storageNamespace()).to.be.eq(2);
    expect(to_hex(pushResult.data)).to.be.deep.eq(
      '9ffb5347e061ac40d937ae4f1a890031475bdc11653f94c8ae1d516ffda71d9ee9cdaf9fbaeb15d835cdc7b3b6ecc120361f004ff172dd5e757c80ede10e88945536e6841255a7bca73664ab8a0607fcfe2579c05bb3d9d4b34ac1de2921e703783ce39e317a512cb9d4e3b59176cbde47b5ba24a03065bf8fefe3e8ca2609e0ad10c7c9c3f81dc6d3a399bda0c190e8a228d0acb22863ab84c2d0c411be74dac4de1f8bc18539635db01ea1ef7f28e505703d67786cb419690edd4bd8c92926fc1d6449eaccc31d7d9639e1b36222e5672b87d1e34b7860308c3f40b3997f39fecf6ceb889323826fa69e001816307799fc9fed302a90faa1e43f7cd7367c3c'
    );

    // This should also be unset:
    const picResult = conf.getProfilePic();
    expect(picResult.url).to.be.null;
    expect(picResult.key).to.be.null;

    // Now let's go set a profile name and picture:
    conf.setProfilePic('http://example.org/omg-pic-123.bmp', stringToUint8Array('secret'));
    conf.setName('Kallie');

    // Retrieve them just to make sure they set properly:
    const name = conf.getName();

    expect(name).to.be.not.null;
    expect(name).to.be.eq('Kallie');

    const picture = conf.getProfilePic();

    expect(picture.url).to.be.eq('http://example.org/omg-pic-123.bmp');
    expect(picture.key).to.be.deep.eq(stringToUint8Array('secret'));

    // Since we've made changes, we should need to push new config to the swarm, *and* should need
    // to dump the updated state:

    expect(conf.needsDump()).to.be.true;
    expect(conf.needsPush()).to.be.true;

    // incremented since we made changes (this only increments once between
    // dumps; even though we changed two fields here).
    pushResult = conf.push();
    expect(pushResult.seqno).to.be.eq(1);

    const expHash0 = from_hex('ea173b57beca8af18c3519a7bbf69c3e7a05d1c049fa9558341d8ebb48b0c965');

    const expPush1Start =
      'd1:#i1e1:&d1:n6:Kallie1:p34:http://example.org/omg-pic-123.bmp1:q6:secrete1:<lli0e32:';
    const expPush1End = 'deee1:=d1:n0:1:p0:1:q0:ee';

    // The data to be actually pushed, expanded like this to make it somewhat human-readable:
    const expPush1Decrypted = concatUInt8Array(
      stringToUint8Array(expPush1Start),
      expHash0,
      stringToUint8Array(expPush1End)
    );
    const expPush1Encrypted = from_hex(
      'a2952190dcb9797bc48e48f6dc7b3254d004bde9091cfc9ec3433cbc5939a3726deb04f58a546d7d79e6f80ea185d43bf93278398556304998ae882304075c77f15c67f9914c4d10005a661f29ff7a79e0a9de7f21725ba3b5a6c19eaa3797671b8fa4008d62e9af2744629cbb46664c4d8048e2867f66ed9254120371bdb24e95b2d92341fa3b1f695046113a768ceb7522269f937ead5591bfa8a5eeee3010474002f2db9de043f0f0d1cfb1066a03e7b5d6cfb70a8f84a20cd2df5a510cd3d175708015a52dd4a105886d916db0005dbea5706e5a5dc37ffd0a0ca2824b524da2e2ad181a48bb38e21ed9abe136014a4ee1e472cb2f53102db2a46afa9d68'
    );

    expect(to_hex(pushResult.data)).to.be.deep.eq(to_hex(expPush1Encrypted));

    // We haven't dumped, so still need to dump:
    expect(conf.needsDump()).to.be.true;
    // We did call push, but we haven't confirmed it as stored yet, so this will still return true:
    expect(conf.needsPush()).to.be.true;

    const dumped = conf.dump();
    // (in a real client we'd now store this to disk)
    expect(conf.needsDump()).to.be.false;

    const expectedDump = concatUInt8Array(
      stringToUint8Array('d' + '1:!' + 'i2e' + '1:$' + `${expPush1Decrypted.length}` + ':'),
      expPush1Decrypted,
      stringToUint8Array('e')
    );
    expect(to_hex(dumped)).to.be.deep.eq(to_hex(expectedDump));

    // So now imagine we got back confirmation from the swarm that the push has been stored:
    conf.confirmPushed(pushResult.seqno);
    expect(conf.needsPush()).to.be.false;
    expect(conf.needsDump()).to.be.true;

    conf.dump();
    expect(conf.needsDump()).to.be.false;

    // Now we're going to set up a second, competing config object (in the real world this would be
    // another Session client somewhere).

    // Start with an empty config, as above:

    const conf2 = new SessionUtilWrapper.UserConfigWrapper(edSecretKey, null);

    expect(conf2.needsDump()).to.be.false;

    // Now imagine we just pulled down the encrypted string from the swarm; we merge it into conf2:
    const accepted = conf2.merge([expPush1Encrypted]);
    expect(accepted).to.be.eq(1);

    // Our state has changed, so we need to dump:
    expect(conf2.needsDump()).to.be.true;
    conf2.dump();
    // (store in db)
    expect(conf2.needsDump()).to.be.false;

    // We *don't* need to push: even though we updated, all we did is update to the merged data (and
    // didn't have any sort of merge conflict needed):
    expect(conf2.needsPush()).to.be.false;

    // Now let's create a conflicting update:
    // Change the name on both clients:
    conf.setName('Nibbler');
    conf2.setName('Raz');

    // And, on conf2, we're also going to change the profile pic:
    conf2.setProfilePic('http://new.example.com/pic', stringToUint8Array('qwert\0yuio'));

    // Both have changes, so push need a push
    expect(conf.needsPush()).to.be.true;
    expect(conf2.needsPush()).to.be.true;
    pushResult = conf.push();
    expect(pushResult.seqno).to.be.eq(2); // incremented, since we made a field change

    let pushResult2 = conf2.push();
    expect(pushResult2.seqno).to.be.eq(2); // incremented, since we made a field change

    // (store in db)
    conf.dump();
    conf2.dump();

    // Since we set different things, we're going to get back different serialized data to be
    // pushed:
    expect(to_hex(pushResult.data)).to.not.be.deep.eq(to_hex(pushResult2.data));

    // Now imagine that each client pushed its `seqno=2` config to the swarm, but then each client
    // also fetches new messages and pulls down the other client's `seqno=2` value.

    // Feed the new config into each other.  (This array could hold multiple configs if we pulled
    // down more than one).
    conf2.merge([pushResult.data]);
    conf.merge([pushResult2.data]);

    // Now after the merge we *will* want to push from both client, since both will have generated a
    // merge conflict update (with seqno = 3).
    expect(conf.needsPush()).to.be.true;
    expect(conf2.needsPush()).to.be.true;

    pushResult = conf.push();
    pushResult2 = conf2.push();
    expect(pushResult.seqno).to.be.eq(3);
    expect(pushResult2.seqno).to.be.eq(3);

    // They should have resolved the conflict to the same thing:
    expect(conf.getName()).to.be.eq('Nibbler');
    expect(conf2.getName()).to.be.eq('Nibbler');

    // (Note that they could have also both resolved to "Raz" here, but the hash of the serialized
    // message just happens to have a higher hash -- and thus gets priority -- for this particular
    // test).

    // Since only one of them set a profile pic there should be no conflict there:
    const pic = conf.getProfilePic();
    const pic2 = conf2.getProfilePic();
    expect(pic.url).to.be.eq('http://new.example.com/pic');
    expect(pic2.url).to.be.eq('http://new.example.com/pic');

    expect(pic.key).to.be.deep.eq(stringToUint8Array('qwert\0yuio'));
    expect(pic2.key).to.be.deep.eq(stringToUint8Array('qwert\0yuio'));

    conf.confirmPushed(pushResult.seqno);
    conf2.confirmPushed(pushResult2.seqno);

    conf.dump();
    conf2.dump();
    // (store in db)

    expect(conf.needsPush()).to.be.false;
    expect(conf.needsDump()).to.be.false;
    expect(conf2.needsPush()).to.be.false;
    expect(conf2.needsDump()).to.be.false;
  });
});

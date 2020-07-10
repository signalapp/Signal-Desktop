describe('ProtoBuf.js', () => {
  const { ProtoBuf } = window.dcodeIO;

  const sampleProto = `message Simple_v1 {
    optional string knownName  = 1;
    optional string knownValue = 3;
  }
  message Simple_v2 {
    optional string knownName  = 1;
    optional int32  unknownFlags = 2;
    optional string knownValue = 3;
    optional string unknownString = 4;
  }`;

  it('retains unknown fields', () => {
    const builder = ProtoBuf.loadProto(sampleProto);
    const protos = builder.build();

    const v2 = new protos.Simple_v2();
    v2.knownName = 'version2';
    v2.unknownFlags = 42;
    v2.knownValue = 'known value';
    v2.unknownString = 'f';

    const v1 = protos.Simple_v1.decode(v2.encode());

    const result = protos.Simple_v2.decode(v1.encode());

    assert.equal(result.knownName, v2.knownName, 'known fields');
    assert.equal(42, result.unknownFlags, 'unknown flag');
    assert.equal('f', result.unknownString, 'unknown string');
    assert.equal('known value', result.knownValue, 'known value');
  });

  it('supports nested unknown fields', () => {
    const nestedProto = `
    ${sampleProto}
    message Container_v1 {
      optional Simple_v1 elem = 1;
    }
    message Container_v2 {
      optional Simple_v2 elem = 1;
    }`;

    const builder = ProtoBuf.loadProto(nestedProto);
    const protos = builder.build();

    const v2 = new protos.Container_v2();
    v2.elem = {
      knownName: 'nested v2',
      unknownFlags: 10,
      knownValue: 'hello world',
    };

    const v1 = protos.Container_v1.decode(v2.encode());

    const result = protos.Container_v2.decode(v1.encode());

    assert.equal(
      v2.elem.knownName,
      result.elem.knownName,
      'nested: known fields'
    );
    assert.equal(10, result.elem.unknownFlags, 'nested: unknown flags');
    assert.equal('hello world', result.elem.knownValue, 'known value');
  });

  it('allows multi-byte id', () => {
    const proto = `message Simple_v1 {
      optional string knownName  = 1;
      optional string knownValue = 3;
    }
    message Simple_v2 {
      optional string knownName  = 1;
      optional int32  unknownFlags = 296;
      optional string knownValue = 3;
    }`;

    const builder = ProtoBuf.loadProto(proto);
    const protos = builder.build();

    const v2 = new protos.Simple_v2();
    v2.knownName = 'v2 multibyte';
    v2.unknownFlags = 16;
    v2.knownValue = 'foo bar';

    const v1 = protos.Simple_v1.decode(v2.encode());

    const result = protos.Simple_v2.decode(v1.encode());

    assert.equal(result.knownName, v2.knownName, 'multibyte: known fields');
    assert.equal(16, result.unknownFlags, 'multibyte: unknown fields');
    assert.equal('foo bar', result.knownValue, 'multibyte: known value');
  });

  it('retains fields with 64bit type', () => {
    const proto = `message Simple_v1 {
      optional string knownName  = 1;
      optional string knownValue = 3;
    }
    message Simple_v2 {
      optional string knownName  = 1;
      optional double unknownFlags = 2;
      optional string knownValue = 3;
    }`;

    const builder = ProtoBuf.loadProto(proto);
    const protos = builder.build();

    const v2 = new protos.Simple_v2();
    v2.knownName = 'v2 double';
    v2.unknownFlags = 0;
    v2.knownValue = 'double double';

    const v1 = protos.Simple_v1.decode(v2.encode());

    const result = protos.Simple_v2.decode(v1.encode());

    assert.equal(result.knownName, v2.knownName, 'double: known fields');
    assert.equal(0, result.unknownFlags, 'double: unknown fields');
    assert.equal('double double', result.knownValue, 'double: known value');
  });
});

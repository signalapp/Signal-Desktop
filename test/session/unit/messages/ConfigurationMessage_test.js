var import_chai = require("chai");
var import_keypairs = require("../../../../receiver/keypairs");
var import_constants = require("../../../../session/constants");
var import_ConfigurationMessage = require("../../../../session/messages/outgoing/controlMessage/ConfigurationMessage");
var import_test_utils = require("../../../test-utils");
describe("ConfigurationMessage", () => {
  it("throw if closed group is not set", () => {
    const activeClosedGroups = null;
    const params = {
      activeClosedGroups,
      activeOpenGroups: [],
      timestamp: Date.now(),
      displayName: "displayName",
      contacts: []
    };
    (0, import_chai.expect)(() => new import_ConfigurationMessage.ConfigurationMessage(params)).to.throw("closed group must be set");
  });
  it("throw if open group is not set", () => {
    const activeOpenGroups = null;
    const params = {
      activeClosedGroups: [],
      activeOpenGroups,
      timestamp: Date.now(),
      displayName: "displayName",
      contacts: []
    };
    (0, import_chai.expect)(() => new import_ConfigurationMessage.ConfigurationMessage(params)).to.throw("open group must be set");
  });
  it("throw if display name is not set", () => {
    const params = {
      activeClosedGroups: [],
      activeOpenGroups: [],
      timestamp: Date.now(),
      displayName: void 0,
      contacts: []
    };
    (0, import_chai.expect)(() => new import_ConfigurationMessage.ConfigurationMessage(params)).to.throw("displayName must be set");
  });
  it("throw if display name is set but empty", () => {
    const params = {
      activeClosedGroups: [],
      activeOpenGroups: [],
      timestamp: Date.now(),
      displayName: void 0,
      contacts: []
    };
    (0, import_chai.expect)(() => new import_ConfigurationMessage.ConfigurationMessage(params)).to.throw("displayName must be set");
  });
  it("ttl is 4 days", () => {
    const params = {
      activeClosedGroups: [],
      activeOpenGroups: [],
      timestamp: Date.now(),
      displayName: "displayName",
      contacts: []
    };
    const configMessage = new import_ConfigurationMessage.ConfigurationMessage(params);
    (0, import_chai.expect)(configMessage.ttl()).to.be.equal(import_constants.TTL_DEFAULT.TTL_MAX);
  });
  describe("ConfigurationMessageClosedGroup", () => {
    it("throw if closed group has no encryptionkeypair", () => {
      const member = import_test_utils.TestUtils.generateFakePubKey().key;
      const params = {
        publicKey: import_test_utils.TestUtils.generateFakePubKey().key,
        name: "groupname",
        members: [member],
        admins: [member],
        encryptionKeyPair: void 0
      };
      (0, import_chai.expect)(() => new import_ConfigurationMessage.ConfigurationMessageClosedGroup(params)).to.throw("Encryption key pair looks invalid");
    });
    it("throw if closed group has invalid encryptionkeypair", () => {
      const member = import_test_utils.TestUtils.generateFakePubKey().key;
      const params = {
        publicKey: import_test_utils.TestUtils.generateFakePubKey().key,
        name: "groupname",
        members: [member],
        admins: [member],
        encryptionKeyPair: new import_keypairs.ECKeyPair(new Uint8Array(), new Uint8Array())
      };
      (0, import_chai.expect)(() => new import_ConfigurationMessage.ConfigurationMessageClosedGroup(params)).to.throw("Encryption key pair looks invalid");
    });
    it("throw if closed group has invalid pubkey", () => {
      const member = import_test_utils.TestUtils.generateFakePubKey().key;
      const params = {
        publicKey: "invalidpubkey",
        name: "groupname",
        members: [member],
        admins: [member],
        encryptionKeyPair: import_test_utils.TestUtils.generateFakeECKeyPair()
      };
      (0, import_chai.expect)(() => new import_ConfigurationMessage.ConfigurationMessageClosedGroup(params)).to.throw();
    });
    it("throw if closed group has invalid name", () => {
      const member = import_test_utils.TestUtils.generateFakePubKey().key;
      const params = {
        publicKey: import_test_utils.TestUtils.generateFakePubKey().key,
        name: "",
        members: [member],
        admins: [member],
        encryptionKeyPair: import_test_utils.TestUtils.generateFakeECKeyPair()
      };
      (0, import_chai.expect)(() => new import_ConfigurationMessage.ConfigurationMessageClosedGroup(params)).to.throw("name must be set");
    });
    it("throw if members is empty", () => {
      const member = import_test_utils.TestUtils.generateFakePubKey().key;
      const params = {
        publicKey: import_test_utils.TestUtils.generateFakePubKey().key,
        name: "groupname",
        members: [],
        admins: [member],
        encryptionKeyPair: import_test_utils.TestUtils.generateFakeECKeyPair()
      };
      (0, import_chai.expect)(() => new import_ConfigurationMessage.ConfigurationMessageClosedGroup(params)).to.throw("members must be set");
    });
    it("throw if admins is empty", () => {
      const member = import_test_utils.TestUtils.generateFakePubKey().key;
      const params = {
        publicKey: import_test_utils.TestUtils.generateFakePubKey().key,
        name: "groupname",
        members: [member],
        admins: [],
        encryptionKeyPair: import_test_utils.TestUtils.generateFakeECKeyPair()
      };
      (0, import_chai.expect)(() => new import_ConfigurationMessage.ConfigurationMessageClosedGroup(params)).to.throw("admins must be set");
    });
    it("throw if some admins are not members", () => {
      const member = import_test_utils.TestUtils.generateFakePubKey().key;
      const admin = import_test_utils.TestUtils.generateFakePubKey().key;
      const params = {
        publicKey: import_test_utils.TestUtils.generateFakePubKey().key,
        name: "groupname",
        members: [member],
        admins: [admin],
        encryptionKeyPair: import_test_utils.TestUtils.generateFakeECKeyPair()
      };
      (0, import_chai.expect)(() => new import_ConfigurationMessage.ConfigurationMessageClosedGroup(params)).to.throw("some admins are not members");
    });
  });
  describe("ConfigurationMessageContact", () => {
    it("throws if contacts is not set", () => {
      const params = {
        activeClosedGroups: [],
        activeOpenGroups: [],
        timestamp: Date.now(),
        displayName: "displayName",
        contacts: void 0
      };
      (0, import_chai.expect)(() => new import_ConfigurationMessage.ConfigurationMessage(params)).to.throw("contacts must be set");
    });
    it("throw if some admins are not members", () => {
      const member = import_test_utils.TestUtils.generateFakePubKey().key;
      const admin = import_test_utils.TestUtils.generateFakePubKey().key;
      const params = {
        publicKey: import_test_utils.TestUtils.generateFakePubKey().key,
        name: "groupname",
        members: [member],
        admins: [admin],
        encryptionKeyPair: import_test_utils.TestUtils.generateFakeECKeyPair()
      };
      (0, import_chai.expect)(() => new import_ConfigurationMessage.ConfigurationMessageClosedGroup(params)).to.throw("some admins are not members");
    });
    it("throw if the contact has not a valid pubkey", () => {
      const params = {
        publicKey: "05",
        displayName: "contactDisplayName"
      };
      (0, import_chai.expect)(() => new import_ConfigurationMessage.ConfigurationMessageContact(params)).to.throw();
      const params2 = {
        publicKey: void 0,
        displayName: "contactDisplayName"
      };
      (0, import_chai.expect)(() => new import_ConfigurationMessage.ConfigurationMessageContact(params2)).to.throw();
    });
    it("throw if the contact has an empty display name", () => {
      (0, import_chai.expect)(() => new import_ConfigurationMessage.ConfigurationMessageContact(params2)).to.throw();
      const params2 = {
        publicKey: import_test_utils.TestUtils.generateFakePubKey().key,
        displayName: ""
      };
      (0, import_chai.expect)(() => new import_ConfigurationMessage.ConfigurationMessageContact(params2)).to.throw();
    });
    it("throw if the contact has a profileAvatar set but empty", () => {
      const params = {
        publicKey: import_test_utils.TestUtils.generateFakePubKey().key,
        displayName: "contactDisplayName",
        profilePictureURL: ""
      };
      (0, import_chai.expect)(() => new import_ConfigurationMessage.ConfigurationMessageContact(params)).to.throw("profilePictureURL must either undefined or not empty");
    });
    it("throw if the contact has a profileKey set but empty", () => {
      const params = {
        publicKey: import_test_utils.TestUtils.generateFakePubKey().key,
        displayName: "contactDisplayName",
        profileKey: new Uint8Array()
      };
      (0, import_chai.expect)(() => new import_ConfigurationMessage.ConfigurationMessageContact(params)).to.throw("profileKey must either undefined or not empty");
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vdHMvdGVzdC9zZXNzaW9uL3VuaXQvbWVzc2FnZXMvQ29uZmlndXJhdGlvbk1lc3NhZ2VfdGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgZXhwZWN0IH0gZnJvbSAnY2hhaSc7XG5pbXBvcnQgeyBFQ0tleVBhaXIgfSBmcm9tICcuLi8uLi8uLi8uLi9yZWNlaXZlci9rZXlwYWlycyc7XG5pbXBvcnQgeyBUVExfREVGQVVMVCB9IGZyb20gJy4uLy4uLy4uLy4uL3Nlc3Npb24vY29uc3RhbnRzJztcblxuaW1wb3J0IHtcbiAgQ29uZmlndXJhdGlvbk1lc3NhZ2UsXG4gIENvbmZpZ3VyYXRpb25NZXNzYWdlQ2xvc2VkR3JvdXAsXG4gIENvbmZpZ3VyYXRpb25NZXNzYWdlQ29udGFjdCxcbn0gZnJvbSAnLi4vLi4vLi4vLi4vc2Vzc2lvbi9tZXNzYWdlcy9vdXRnb2luZy9jb250cm9sTWVzc2FnZS9Db25maWd1cmF0aW9uTWVzc2FnZSc7XG5pbXBvcnQgeyBUZXN0VXRpbHMgfSBmcm9tICcuLi8uLi8uLi90ZXN0LXV0aWxzJztcblxuLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOiBtYXgtZnVuYy1ib2R5LWxlbmd0aFxuZGVzY3JpYmUoJ0NvbmZpZ3VyYXRpb25NZXNzYWdlJywgKCkgPT4ge1xuICBpdCgndGhyb3cgaWYgY2xvc2VkIGdyb3VwIGlzIG5vdCBzZXQnLCAoKSA9PiB7XG4gICAgY29uc3QgYWN0aXZlQ2xvc2VkR3JvdXBzID0gbnVsbCBhcyBhbnk7XG4gICAgY29uc3QgcGFyYW1zID0ge1xuICAgICAgYWN0aXZlQ2xvc2VkR3JvdXBzLFxuICAgICAgYWN0aXZlT3Blbkdyb3VwczogW10sXG4gICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgICBkaXNwbGF5TmFtZTogJ2Rpc3BsYXlOYW1lJyxcbiAgICAgIGNvbnRhY3RzOiBbXSxcbiAgICB9O1xuICAgIGV4cGVjdCgoKSA9PiBuZXcgQ29uZmlndXJhdGlvbk1lc3NhZ2UocGFyYW1zKSkudG8udGhyb3coJ2Nsb3NlZCBncm91cCBtdXN0IGJlIHNldCcpO1xuICB9KTtcblxuICBpdCgndGhyb3cgaWYgb3BlbiBncm91cCBpcyBub3Qgc2V0JywgKCkgPT4ge1xuICAgIGNvbnN0IGFjdGl2ZU9wZW5Hcm91cHMgPSBudWxsIGFzIGFueTtcbiAgICBjb25zdCBwYXJhbXMgPSB7XG4gICAgICBhY3RpdmVDbG9zZWRHcm91cHM6IFtdLFxuICAgICAgYWN0aXZlT3Blbkdyb3VwcyxcbiAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcbiAgICAgIGRpc3BsYXlOYW1lOiAnZGlzcGxheU5hbWUnLFxuICAgICAgY29udGFjdHM6IFtdLFxuICAgIH07XG4gICAgZXhwZWN0KCgpID0+IG5ldyBDb25maWd1cmF0aW9uTWVzc2FnZShwYXJhbXMpKS50by50aHJvdygnb3BlbiBncm91cCBtdXN0IGJlIHNldCcpO1xuICB9KTtcblxuICBpdCgndGhyb3cgaWYgZGlzcGxheSBuYW1lIGlzIG5vdCBzZXQnLCAoKSA9PiB7XG4gICAgY29uc3QgcGFyYW1zID0ge1xuICAgICAgYWN0aXZlQ2xvc2VkR3JvdXBzOiBbXSxcbiAgICAgIGFjdGl2ZU9wZW5Hcm91cHM6IFtdLFxuICAgICAgdGltZXN0YW1wOiBEYXRlLm5vdygpLFxuICAgICAgZGlzcGxheU5hbWU6IHVuZGVmaW5lZCBhcyBhbnksXG4gICAgICBjb250YWN0czogW10sXG4gICAgfTtcbiAgICBleHBlY3QoKCkgPT4gbmV3IENvbmZpZ3VyYXRpb25NZXNzYWdlKHBhcmFtcykpLnRvLnRocm93KCdkaXNwbGF5TmFtZSBtdXN0IGJlIHNldCcpO1xuICB9KTtcblxuICBpdCgndGhyb3cgaWYgZGlzcGxheSBuYW1lIGlzIHNldCBidXQgZW1wdHknLCAoKSA9PiB7XG4gICAgY29uc3QgcGFyYW1zID0ge1xuICAgICAgYWN0aXZlQ2xvc2VkR3JvdXBzOiBbXSxcbiAgICAgIGFjdGl2ZU9wZW5Hcm91cHM6IFtdLFxuICAgICAgdGltZXN0YW1wOiBEYXRlLm5vdygpLFxuICAgICAgZGlzcGxheU5hbWU6IHVuZGVmaW5lZCBhcyBhbnksXG4gICAgICBjb250YWN0czogW10sXG4gICAgfTtcbiAgICBleHBlY3QoKCkgPT4gbmV3IENvbmZpZ3VyYXRpb25NZXNzYWdlKHBhcmFtcykpLnRvLnRocm93KCdkaXNwbGF5TmFtZSBtdXN0IGJlIHNldCcpO1xuICB9KTtcblxuICBpdCgndHRsIGlzIDQgZGF5cycsICgpID0+IHtcbiAgICBjb25zdCBwYXJhbXMgPSB7XG4gICAgICBhY3RpdmVDbG9zZWRHcm91cHM6IFtdLFxuICAgICAgYWN0aXZlT3Blbkdyb3VwczogW10sXG4gICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgICBkaXNwbGF5TmFtZTogJ2Rpc3BsYXlOYW1lJyxcbiAgICAgIGNvbnRhY3RzOiBbXSxcbiAgICB9O1xuICAgIGNvbnN0IGNvbmZpZ01lc3NhZ2UgPSBuZXcgQ29uZmlndXJhdGlvbk1lc3NhZ2UocGFyYW1zKTtcbiAgICBleHBlY3QoY29uZmlnTWVzc2FnZS50dGwoKSkudG8uYmUuZXF1YWwoVFRMX0RFRkFVTFQuVFRMX01BWCk7XG4gIH0pO1xuXG4gIGRlc2NyaWJlKCdDb25maWd1cmF0aW9uTWVzc2FnZUNsb3NlZEdyb3VwJywgKCkgPT4ge1xuICAgIGl0KCd0aHJvdyBpZiBjbG9zZWQgZ3JvdXAgaGFzIG5vIGVuY3J5cHRpb25rZXlwYWlyJywgKCkgPT4ge1xuICAgICAgY29uc3QgbWVtYmVyID0gVGVzdFV0aWxzLmdlbmVyYXRlRmFrZVB1YktleSgpLmtleTtcbiAgICAgIGNvbnN0IHBhcmFtcyA9IHtcbiAgICAgICAgcHVibGljS2V5OiBUZXN0VXRpbHMuZ2VuZXJhdGVGYWtlUHViS2V5KCkua2V5LFxuICAgICAgICBuYW1lOiAnZ3JvdXBuYW1lJyxcbiAgICAgICAgbWVtYmVyczogW21lbWJlcl0sXG4gICAgICAgIGFkbWluczogW21lbWJlcl0sXG4gICAgICAgIGVuY3J5cHRpb25LZXlQYWlyOiB1bmRlZmluZWQgYXMgYW55LFxuICAgICAgfTtcblxuICAgICAgZXhwZWN0KCgpID0+IG5ldyBDb25maWd1cmF0aW9uTWVzc2FnZUNsb3NlZEdyb3VwKHBhcmFtcykpLnRvLnRocm93KFxuICAgICAgICAnRW5jcnlwdGlvbiBrZXkgcGFpciBsb29rcyBpbnZhbGlkJ1xuICAgICAgKTtcbiAgICB9KTtcblxuICAgIGl0KCd0aHJvdyBpZiBjbG9zZWQgZ3JvdXAgaGFzIGludmFsaWQgZW5jcnlwdGlvbmtleXBhaXInLCAoKSA9PiB7XG4gICAgICBjb25zdCBtZW1iZXIgPSBUZXN0VXRpbHMuZ2VuZXJhdGVGYWtlUHViS2V5KCkua2V5O1xuICAgICAgY29uc3QgcGFyYW1zID0ge1xuICAgICAgICBwdWJsaWNLZXk6IFRlc3RVdGlscy5nZW5lcmF0ZUZha2VQdWJLZXkoKS5rZXksXG4gICAgICAgIG5hbWU6ICdncm91cG5hbWUnLFxuICAgICAgICBtZW1iZXJzOiBbbWVtYmVyXSxcbiAgICAgICAgYWRtaW5zOiBbbWVtYmVyXSxcbiAgICAgICAgZW5jcnlwdGlvbktleVBhaXI6IG5ldyBFQ0tleVBhaXIobmV3IFVpbnQ4QXJyYXkoKSwgbmV3IFVpbnQ4QXJyYXkoKSksXG4gICAgICB9O1xuXG4gICAgICBleHBlY3QoKCkgPT4gbmV3IENvbmZpZ3VyYXRpb25NZXNzYWdlQ2xvc2VkR3JvdXAocGFyYW1zKSkudG8udGhyb3coXG4gICAgICAgICdFbmNyeXB0aW9uIGtleSBwYWlyIGxvb2tzIGludmFsaWQnXG4gICAgICApO1xuICAgIH0pO1xuXG4gICAgaXQoJ3Rocm93IGlmIGNsb3NlZCBncm91cCBoYXMgaW52YWxpZCBwdWJrZXknLCAoKSA9PiB7XG4gICAgICBjb25zdCBtZW1iZXIgPSBUZXN0VXRpbHMuZ2VuZXJhdGVGYWtlUHViS2V5KCkua2V5O1xuICAgICAgY29uc3QgcGFyYW1zID0ge1xuICAgICAgICBwdWJsaWNLZXk6ICdpbnZhbGlkcHVia2V5JyxcbiAgICAgICAgbmFtZTogJ2dyb3VwbmFtZScsXG4gICAgICAgIG1lbWJlcnM6IFttZW1iZXJdLFxuICAgICAgICBhZG1pbnM6IFttZW1iZXJdLFxuICAgICAgICBlbmNyeXB0aW9uS2V5UGFpcjogVGVzdFV0aWxzLmdlbmVyYXRlRmFrZUVDS2V5UGFpcigpLFxuICAgICAgfTtcblxuICAgICAgZXhwZWN0KCgpID0+IG5ldyBDb25maWd1cmF0aW9uTWVzc2FnZUNsb3NlZEdyb3VwKHBhcmFtcykpLnRvLnRocm93KCk7XG4gICAgfSk7XG5cbiAgICBpdCgndGhyb3cgaWYgY2xvc2VkIGdyb3VwIGhhcyBpbnZhbGlkIG5hbWUnLCAoKSA9PiB7XG4gICAgICBjb25zdCBtZW1iZXIgPSBUZXN0VXRpbHMuZ2VuZXJhdGVGYWtlUHViS2V5KCkua2V5O1xuICAgICAgY29uc3QgcGFyYW1zID0ge1xuICAgICAgICBwdWJsaWNLZXk6IFRlc3RVdGlscy5nZW5lcmF0ZUZha2VQdWJLZXkoKS5rZXksXG4gICAgICAgIG5hbWU6ICcnLFxuICAgICAgICBtZW1iZXJzOiBbbWVtYmVyXSxcbiAgICAgICAgYWRtaW5zOiBbbWVtYmVyXSxcbiAgICAgICAgZW5jcnlwdGlvbktleVBhaXI6IFRlc3RVdGlscy5nZW5lcmF0ZUZha2VFQ0tleVBhaXIoKSxcbiAgICAgIH07XG5cbiAgICAgIGV4cGVjdCgoKSA9PiBuZXcgQ29uZmlndXJhdGlvbk1lc3NhZ2VDbG9zZWRHcm91cChwYXJhbXMpKS50by50aHJvdygnbmFtZSBtdXN0IGJlIHNldCcpO1xuICAgIH0pO1xuXG4gICAgaXQoJ3Rocm93IGlmIG1lbWJlcnMgaXMgZW1wdHknLCAoKSA9PiB7XG4gICAgICBjb25zdCBtZW1iZXIgPSBUZXN0VXRpbHMuZ2VuZXJhdGVGYWtlUHViS2V5KCkua2V5O1xuICAgICAgY29uc3QgcGFyYW1zID0ge1xuICAgICAgICBwdWJsaWNLZXk6IFRlc3RVdGlscy5nZW5lcmF0ZUZha2VQdWJLZXkoKS5rZXksXG4gICAgICAgIG5hbWU6ICdncm91cG5hbWUnLFxuICAgICAgICBtZW1iZXJzOiBbXSxcbiAgICAgICAgYWRtaW5zOiBbbWVtYmVyXSxcbiAgICAgICAgZW5jcnlwdGlvbktleVBhaXI6IFRlc3RVdGlscy5nZW5lcmF0ZUZha2VFQ0tleVBhaXIoKSxcbiAgICAgIH07XG5cbiAgICAgIGV4cGVjdCgoKSA9PiBuZXcgQ29uZmlndXJhdGlvbk1lc3NhZ2VDbG9zZWRHcm91cChwYXJhbXMpKS50by50aHJvdygnbWVtYmVycyBtdXN0IGJlIHNldCcpO1xuICAgIH0pO1xuXG4gICAgaXQoJ3Rocm93IGlmIGFkbWlucyBpcyBlbXB0eScsICgpID0+IHtcbiAgICAgIGNvbnN0IG1lbWJlciA9IFRlc3RVdGlscy5nZW5lcmF0ZUZha2VQdWJLZXkoKS5rZXk7XG4gICAgICBjb25zdCBwYXJhbXMgPSB7XG4gICAgICAgIHB1YmxpY0tleTogVGVzdFV0aWxzLmdlbmVyYXRlRmFrZVB1YktleSgpLmtleSxcbiAgICAgICAgbmFtZTogJ2dyb3VwbmFtZScsXG4gICAgICAgIG1lbWJlcnM6IFttZW1iZXJdLFxuICAgICAgICBhZG1pbnM6IFtdLFxuICAgICAgICBlbmNyeXB0aW9uS2V5UGFpcjogVGVzdFV0aWxzLmdlbmVyYXRlRmFrZUVDS2V5UGFpcigpLFxuICAgICAgfTtcblxuICAgICAgZXhwZWN0KCgpID0+IG5ldyBDb25maWd1cmF0aW9uTWVzc2FnZUNsb3NlZEdyb3VwKHBhcmFtcykpLnRvLnRocm93KCdhZG1pbnMgbXVzdCBiZSBzZXQnKTtcbiAgICB9KTtcblxuICAgIGl0KCd0aHJvdyBpZiBzb21lIGFkbWlucyBhcmUgbm90IG1lbWJlcnMnLCAoKSA9PiB7XG4gICAgICBjb25zdCBtZW1iZXIgPSBUZXN0VXRpbHMuZ2VuZXJhdGVGYWtlUHViS2V5KCkua2V5O1xuICAgICAgY29uc3QgYWRtaW4gPSBUZXN0VXRpbHMuZ2VuZXJhdGVGYWtlUHViS2V5KCkua2V5O1xuICAgICAgY29uc3QgcGFyYW1zID0ge1xuICAgICAgICBwdWJsaWNLZXk6IFRlc3RVdGlscy5nZW5lcmF0ZUZha2VQdWJLZXkoKS5rZXksXG4gICAgICAgIG5hbWU6ICdncm91cG5hbWUnLFxuICAgICAgICBtZW1iZXJzOiBbbWVtYmVyXSxcbiAgICAgICAgYWRtaW5zOiBbYWRtaW5dLFxuICAgICAgICBlbmNyeXB0aW9uS2V5UGFpcjogVGVzdFV0aWxzLmdlbmVyYXRlRmFrZUVDS2V5UGFpcigpLFxuICAgICAgfTtcblxuICAgICAgZXhwZWN0KCgpID0+IG5ldyBDb25maWd1cmF0aW9uTWVzc2FnZUNsb3NlZEdyb3VwKHBhcmFtcykpLnRvLnRocm93KFxuICAgICAgICAnc29tZSBhZG1pbnMgYXJlIG5vdCBtZW1iZXJzJ1xuICAgICAgKTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgZGVzY3JpYmUoJ0NvbmZpZ3VyYXRpb25NZXNzYWdlQ29udGFjdCcsICgpID0+IHtcbiAgICBpdCgndGhyb3dzIGlmIGNvbnRhY3RzIGlzIG5vdCBzZXQnLCAoKSA9PiB7XG4gICAgICBjb25zdCBwYXJhbXMgPSB7XG4gICAgICAgIGFjdGl2ZUNsb3NlZEdyb3VwczogW10sXG4gICAgICAgIGFjdGl2ZU9wZW5Hcm91cHM6IFtdLFxuICAgICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgICAgIGRpc3BsYXlOYW1lOiAnZGlzcGxheU5hbWUnLFxuICAgICAgICBjb250YWN0czogdW5kZWZpbmVkIGFzIGFueSxcbiAgICAgIH07XG4gICAgICBleHBlY3QoKCkgPT4gbmV3IENvbmZpZ3VyYXRpb25NZXNzYWdlKHBhcmFtcykpLnRvLnRocm93KCdjb250YWN0cyBtdXN0IGJlIHNldCcpO1xuICAgIH0pO1xuICAgIGl0KCd0aHJvdyBpZiBzb21lIGFkbWlucyBhcmUgbm90IG1lbWJlcnMnLCAoKSA9PiB7XG4gICAgICBjb25zdCBtZW1iZXIgPSBUZXN0VXRpbHMuZ2VuZXJhdGVGYWtlUHViS2V5KCkua2V5O1xuICAgICAgY29uc3QgYWRtaW4gPSBUZXN0VXRpbHMuZ2VuZXJhdGVGYWtlUHViS2V5KCkua2V5O1xuICAgICAgY29uc3QgcGFyYW1zID0ge1xuICAgICAgICBwdWJsaWNLZXk6IFRlc3RVdGlscy5nZW5lcmF0ZUZha2VQdWJLZXkoKS5rZXksXG4gICAgICAgIG5hbWU6ICdncm91cG5hbWUnLFxuICAgICAgICBtZW1iZXJzOiBbbWVtYmVyXSxcbiAgICAgICAgYWRtaW5zOiBbYWRtaW5dLFxuICAgICAgICBlbmNyeXB0aW9uS2V5UGFpcjogVGVzdFV0aWxzLmdlbmVyYXRlRmFrZUVDS2V5UGFpcigpLFxuICAgICAgfTtcblxuICAgICAgZXhwZWN0KCgpID0+IG5ldyBDb25maWd1cmF0aW9uTWVzc2FnZUNsb3NlZEdyb3VwKHBhcmFtcykpLnRvLnRocm93KFxuICAgICAgICAnc29tZSBhZG1pbnMgYXJlIG5vdCBtZW1iZXJzJ1xuICAgICAgKTtcbiAgICB9KTtcblxuICAgIGl0KCd0aHJvdyBpZiB0aGUgY29udGFjdCBoYXMgbm90IGEgdmFsaWQgcHVia2V5JywgKCkgPT4ge1xuICAgICAgY29uc3QgcGFyYW1zID0ge1xuICAgICAgICBwdWJsaWNLZXk6ICcwNScsXG4gICAgICAgIGRpc3BsYXlOYW1lOiAnY29udGFjdERpc3BsYXlOYW1lJyxcbiAgICAgIH07XG5cbiAgICAgIGV4cGVjdCgoKSA9PiBuZXcgQ29uZmlndXJhdGlvbk1lc3NhZ2VDb250YWN0KHBhcmFtcykpLnRvLnRocm93KCk7XG5cbiAgICAgIGNvbnN0IHBhcmFtczIgPSB7XG4gICAgICAgIHB1YmxpY0tleTogdW5kZWZpbmVkIGFzIGFueSxcbiAgICAgICAgZGlzcGxheU5hbWU6ICdjb250YWN0RGlzcGxheU5hbWUnLFxuICAgICAgfTtcblxuICAgICAgZXhwZWN0KCgpID0+IG5ldyBDb25maWd1cmF0aW9uTWVzc2FnZUNvbnRhY3QocGFyYW1zMikpLnRvLnRocm93KCk7XG4gICAgfSk7XG5cbiAgICBpdCgndGhyb3cgaWYgdGhlIGNvbnRhY3QgaGFzIGFuIGVtcHR5IGRpc3BsYXkgbmFtZScsICgpID0+IHtcbiAgICAgIC8vIGEgZGlzcGxheSBuYW1lIGNhbm5vdCBiZSBlbXB0eSBub3IgdW5kZWZpbmVkXG5cbiAgICAgIGV4cGVjdCgoKSA9PiBuZXcgQ29uZmlndXJhdGlvbk1lc3NhZ2VDb250YWN0KHBhcmFtczIpKS50by50aHJvdygpO1xuXG4gICAgICBjb25zdCBwYXJhbXMyID0ge1xuICAgICAgICBwdWJsaWNLZXk6IFRlc3RVdGlscy5nZW5lcmF0ZUZha2VQdWJLZXkoKS5rZXksXG4gICAgICAgIGRpc3BsYXlOYW1lOiAnJyxcbiAgICAgIH07XG5cbiAgICAgIGV4cGVjdCgoKSA9PiBuZXcgQ29uZmlndXJhdGlvbk1lc3NhZ2VDb250YWN0KHBhcmFtczIpKS50by50aHJvdygpO1xuICAgIH0pO1xuXG4gICAgaXQoJ3Rocm93IGlmIHRoZSBjb250YWN0IGhhcyBhIHByb2ZpbGVBdmF0YXIgc2V0IGJ1dCBlbXB0eScsICgpID0+IHtcbiAgICAgIGNvbnN0IHBhcmFtcyA9IHtcbiAgICAgICAgcHVibGljS2V5OiBUZXN0VXRpbHMuZ2VuZXJhdGVGYWtlUHViS2V5KCkua2V5LFxuICAgICAgICBkaXNwbGF5TmFtZTogJ2NvbnRhY3REaXNwbGF5TmFtZScsXG4gICAgICAgIHByb2ZpbGVQaWN0dXJlVVJMOiAnJyxcbiAgICAgIH07XG5cbiAgICAgIGV4cGVjdCgoKSA9PiBuZXcgQ29uZmlndXJhdGlvbk1lc3NhZ2VDb250YWN0KHBhcmFtcykpLnRvLnRocm93KFxuICAgICAgICAncHJvZmlsZVBpY3R1cmVVUkwgbXVzdCBlaXRoZXIgdW5kZWZpbmVkIG9yIG5vdCBlbXB0eSdcbiAgICAgICk7XG4gICAgfSk7XG5cbiAgICBpdCgndGhyb3cgaWYgdGhlIGNvbnRhY3QgaGFzIGEgcHJvZmlsZUtleSBzZXQgYnV0IGVtcHR5JywgKCkgPT4ge1xuICAgICAgY29uc3QgcGFyYW1zID0ge1xuICAgICAgICBwdWJsaWNLZXk6IFRlc3RVdGlscy5nZW5lcmF0ZUZha2VQdWJLZXkoKS5rZXksXG4gICAgICAgIGRpc3BsYXlOYW1lOiAnY29udGFjdERpc3BsYXlOYW1lJyxcbiAgICAgICAgcHJvZmlsZUtleTogbmV3IFVpbnQ4QXJyYXkoKSxcbiAgICAgIH07XG5cbiAgICAgIGV4cGVjdCgoKSA9PiBuZXcgQ29uZmlndXJhdGlvbk1lc3NhZ2VDb250YWN0KHBhcmFtcykpLnRvLnRocm93KFxuICAgICAgICAncHJvZmlsZUtleSBtdXN0IGVpdGhlciB1bmRlZmluZWQgb3Igbm90IGVtcHR5J1xuICAgICAgKTtcbiAgICB9KTtcbiAgfSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUFBLGtCQUF1QjtBQUN2QixzQkFBMEI7QUFDMUIsdUJBQTRCO0FBRTVCLGtDQUlPO0FBQ1Asd0JBQTBCO0FBRzFCLFNBQVMsd0JBQXdCLE1BQU07QUFDckMsS0FBRyxvQ0FBb0MsTUFBTTtBQUMzQyxVQUFNLHFCQUFxQjtBQUMzQixVQUFNLFNBQVM7QUFBQSxNQUNiO0FBQUEsTUFDQSxrQkFBa0IsQ0FBQztBQUFBLE1BQ25CLFdBQVcsS0FBSyxJQUFJO0FBQUEsTUFDcEIsYUFBYTtBQUFBLE1BQ2IsVUFBVSxDQUFDO0FBQUEsSUFDYjtBQUNBLDRCQUFPLE1BQU0sSUFBSSxpREFBcUIsTUFBTSxDQUFDLEVBQUUsR0FBRyxNQUFNLDBCQUEwQjtBQUFBLEVBQ3BGLENBQUM7QUFFRCxLQUFHLGtDQUFrQyxNQUFNO0FBQ3pDLFVBQU0sbUJBQW1CO0FBQ3pCLFVBQU0sU0FBUztBQUFBLE1BQ2Isb0JBQW9CLENBQUM7QUFBQSxNQUNyQjtBQUFBLE1BQ0EsV0FBVyxLQUFLLElBQUk7QUFBQSxNQUNwQixhQUFhO0FBQUEsTUFDYixVQUFVLENBQUM7QUFBQSxJQUNiO0FBQ0EsNEJBQU8sTUFBTSxJQUFJLGlEQUFxQixNQUFNLENBQUMsRUFBRSxHQUFHLE1BQU0sd0JBQXdCO0FBQUEsRUFDbEYsQ0FBQztBQUVELEtBQUcsb0NBQW9DLE1BQU07QUFDM0MsVUFBTSxTQUFTO0FBQUEsTUFDYixvQkFBb0IsQ0FBQztBQUFBLE1BQ3JCLGtCQUFrQixDQUFDO0FBQUEsTUFDbkIsV0FBVyxL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

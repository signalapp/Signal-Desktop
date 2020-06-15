interface DeviceMappingAnnotation {
  isPrimary: boolean;
  authorisations: Array<{
    primaryDevicePubKey: string;
    secondaryDevicePubKey: string;
    requestSignature: string; // base64
    grantSignature: string; // base64
  }>;
}

interface LokiFileServerInstance {
  getUserDeviceMapping(pubKey: string): Promise<DeviceMappingAnnotation>;
}

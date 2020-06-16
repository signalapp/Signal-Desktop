interface FileServerPairingAuthorisation {
  primaryDevicePubKey: string;
  secondaryDevicePubKey: string;
  requestSignature: string; // base64
  grantSignature: string; // base64
}

interface DeviceMappingAnnotation {
  isPrimary: string;
  authorisations: Array<FileServerPairingAuthorisation>;
}

interface LokiFileServerInstance {
  getUserDeviceMapping(pubKey: string): Promise<DeviceMappingAnnotation>;
  clearOurDeviceMappingAnnotations(): Promise<void>;
}

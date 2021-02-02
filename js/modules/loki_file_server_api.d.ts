interface LokiFileServerInstance {
  downloadAttachment(url: string): Promise<ArrayBuffer>;
}

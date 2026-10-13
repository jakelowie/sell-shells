export class StorageOperationError extends Error {
  constructor(readonly operation: string, readonly storageMessage: string) {
    super(`Supabase Storage ${operation} failed.`);
    this.name = "StorageOperationError";
  }
}

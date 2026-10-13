export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: string[]
  ) {
    super(message);
    this.name = "ApiError";
  }
}

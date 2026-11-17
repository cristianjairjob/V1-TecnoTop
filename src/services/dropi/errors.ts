export class DropiError extends Error {
  constructor(
    public code: string,
    public httpStatus = 502,
    public uncertain = false,
  ) {
    super(code);
    this.name = "DropiError";
  }
}

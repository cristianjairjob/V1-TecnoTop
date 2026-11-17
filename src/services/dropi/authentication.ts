import { DropiError } from "./errors";
export function authentication() {
  const token = process.env.DROPI_API_TOKEN;
  if (!token) throw new DropiError("DROPI_NOT_CONFIGURED", 503);
  return {
    "Content-Type": "application/json;charset=UTF-8",
    "dropi-integration-key": token,
  };
}

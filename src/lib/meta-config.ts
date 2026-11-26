// Dynamic lookup: NEXT_PUBLIC_* must also reflect the running server's environment,
// rather than a value substituted by Next.js when the bundle was built.
export function metaConfig() {
  const read = (name: string) => (process.env[name] || "").trim();
  return {
    pixelId: read("NEXT_PUBLIC_META_PIXEL_ID"),
    accessToken: read("META_CAPI_ACCESS_TOKEN"),
    testEventCode: read("META_TEST_EVENT_CODE"),
    ipHeader: read("META_CLIENT_IP_HEADER").toLowerCase(),
  };
}

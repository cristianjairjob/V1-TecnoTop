export function normalizedPhone(value: string) {
  const digits = value.replace(/[\s()+-]/g, "");
  const national = digits.replace(/^57(?=3\d{9}$)/, "");
  return /^3\d{9}$/.test(national) ? national : null;
}
export function whatsappUrl(value: string) {
  const phone = normalizedPhone(value);
  return phone ? `https://wa.me/57${phone}` : null;
}

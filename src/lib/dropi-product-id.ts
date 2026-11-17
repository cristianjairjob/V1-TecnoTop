import { z } from "zod";

export const dropiProductIdSchema = z.string().trim()
  .regex(/^#?[1-9]\d{0,19}$/, "Escribe el ID numérico del producto de Dropi, por ejemplo 1970619 o #1970619.")
  .transform((value) => value.replace(/^#/, ""));

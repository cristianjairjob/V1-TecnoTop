import { z } from "zod";
export const commercialStatuses = ["PENDIENTE", "CONFIRMADO", "PREPARANDO", "DESPACHADO", "ENTREGADO", "CANCELADO"] as const;
export const orderUpdateSchema = z.object({ id: z.string().min(1).max(100), status: z.enum(commercialStatuses), observation: z.string().trim().max(3000).default("") });

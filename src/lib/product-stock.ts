import { z } from "zod";

export const stockSchema = z.number().int("El stock debe ser un número entero.").min(0, "El stock no puede ser negativo.").max(1000000);

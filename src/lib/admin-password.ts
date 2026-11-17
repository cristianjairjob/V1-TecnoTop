import { compare, hash } from "bcryptjs";
import { z } from "zod";
import { db } from "./db";
import { AppError } from "./http";

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(12).refine((v) => Buffer.byteLength(v, "utf8") <= 72, "La contraseña supera el límite de bcrypt."),
});
export async function changeAdminPassword(admin: { id: string; passwordHash: string }, input: z.infer<typeof passwordChangeSchema>) {
  const data = passwordChangeSchema.parse(input);
  if (!(await compare(data.currentPassword, admin.passwordHash)))
    throw new AppError(403, "La contraseña actual no es correcta.");
  const passwordHash = await hash(data.newPassword, 12);
  await db.$transaction(async (tx) => {
    const result = await tx.adminUser.updateMany({
      where: { id: admin.id, active: true, passwordHash: admin.passwordHash },
      data: { passwordHash },
    });
    if (result.count !== 1) throw new AppError(409, "La cuenta cambió. Inicia sesión de nuevo.");
    await tx.adminSession.deleteMany({ where: { adminId: admin.id } });
    await tx.auditLog.create({ data: { adminId: admin.id, entityId: admin.id, action: "ADMIN_PASSWORD_CHANGED" } });
  });
}

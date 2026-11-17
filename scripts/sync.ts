import { syncInventory } from "../src/services/dropi/inventory";
import { db } from "../src/lib/db";
syncInventory(Number(process.argv[2] || 0))
  .then((r) => console.log(JSON.stringify(r)))
  .catch(() => {
    console.error("Falló la sincronización. Consulta SyncLog.");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

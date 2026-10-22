import { loadConfig } from "./config";
import { migrate, openDb } from "./db";
import { seedDevAccounts, seedReference } from "./seed";
const cfg = loadConfig();
const db = openDb(cfg.dbPath);
migrate(db);
seedReference(db);
console.log("Reference data (paths, levels, activities) is up to date.");
console.log(await seedDevAccounts(db, cfg));

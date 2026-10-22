import { loadConfig } from "./config";
import { migrate, openDb } from "./db";
const db = openDb(loadConfig().dbPath);
const applied = migrate(db);
console.log(applied.length ? `Applied: ${applied.join(", ")}` : "Database already up to date.");

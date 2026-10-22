import { existsSync } from "node:fs";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { migrate, openDb } from "./db";
import { seedReference } from "./seed";

if (existsSync(".env")) process.loadEnvFile(".env");
const cfg = loadConfig();
const db = openDb(cfg.dbPath);
migrate(db);
seedReference(db); // reference data only: never touches users or progress

const app = createApp(db, cfg, { log: true });
app.listen(cfg.port, () => {
  console.log(`NASJ API listening on http://localhost:${cfg.port}`);
  console.log(`AI (Métier à Tisser Magique): ${cfg.ai.apiKey ? "configured" : "NOT configured (set ANTHROPIC_API_KEY)"}`);
});

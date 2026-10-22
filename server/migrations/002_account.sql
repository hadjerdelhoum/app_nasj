-- Additive, non-destructive: existing users keep working (new columns are nullable / defaulted).
ALTER TABLE users ADD COLUMN display_name TEXT;
-- Account recovery WITHOUT e-mail delivery: a one-time recovery code shown to the parent at sign-up.
-- Only its scrypt hash is stored. NULL = no code yet (generate one from the settings screen).
ALTER TABLE users ADD COLUMN recovery_hash TEXT;
ALTER TABLE users ADD COLUMN recovery_failures INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN recovery_locked_until TEXT;

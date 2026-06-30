import postgres from 'postgres'

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL not found");
}

export const sql = postgres(connectionString);

export async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS users(
    id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username  text UNIQUE NOT NULL,
    password_hash  text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
    )
    `
  console.log('Database ready')

  await sql`
    CREATE TABLE IF NOT EXISTS cameras (
      id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name       text NOT NULL,
      rtsp_url   text NOT NULL,
      location   text,
      enabled    boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS alerts (
      id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      camera_id  uuid NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
      label      text NOT NULL,
      count      int NOT NULL DEFAULT 1,
      confidence real,
      bbox       jsonb,
      ts         timestamptz NOT NULL DEFAULT now()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS alerts_camera_ts_idx ON alerts (camera_id, ts DESC)`
}
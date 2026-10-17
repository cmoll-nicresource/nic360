-- Independent schema: Payload schema push must not manage clipper credentials.
CREATE SCHEMA IF NOT EXISTS clipper;
CREATE TABLE IF NOT EXISTS clipper.codes (
  id uuid PRIMARY KEY,
  code_hash char(64) NOT NULL UNIQUE,
  staff_id integer NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  redirect_uri text NOT NULL,
  challenge varchar(43) NOT NULL,
  credential_version char(64) NOT NULL,
  label varchar(80) NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clipper_codes_staff ON clipper.codes(staff_id);
CREATE TABLE IF NOT EXISTS clipper.connections (
  id uuid PRIMARY KEY,
  staff_id integer NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  credential_version char(64) NOT NULL,
  label varchar(80) NOT NULL,
  expires_at timestamptz NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clipper_connections_staff ON clipper.connections(staff_id);

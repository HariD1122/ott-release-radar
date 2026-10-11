-- OTT Release Radar: initial schema. Run with `npm run db:migrate`.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  login_id      text NOT NULL UNIQUE,
  pin_hash      text NOT NULL,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions(user_id);

CREATE TABLE login_attempts (
  id         bigserial PRIMARY KEY,
  login_id   text NOT NULL,
  ip         text,
  succeeded  boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_lookup_idx ON login_attempts(login_id, created_at DESC);

CREATE TABLE user_preferences (
  user_id       uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  genres        text[] NOT NULL DEFAULT '{}',
  languages     text[] NOT NULL DEFAULT '{}',
  platforms     text[] NOT NULL DEFAULT '{}',
  content_types text[] NOT NULL DEFAULT '{}',
  time_zone     text NOT NULL DEFAULT 'Asia/Kolkata',
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE releases (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider                text NOT NULL DEFAULT 'tmdb',
  provider_key            text NOT NULL UNIQUE,
  tmdb_id                 integer NOT NULL,
  imdb_id                 text,
  title                   text NOT NULL,
  content_type            text NOT NULL CHECK (content_type IN ('movie','series','season','episode')),
  series_tmdb_id          integer,
  season_number           integer,
  episode_number          integer,
  episode_title           text,
  synopsis                text,
  poster_url              text,
  backdrop_url            text,
  genres                  text[] NOT NULL DEFAULT '{}',
  languages               text[] NOT NULL DEFAULT '{}',
  platforms               text[] NOT NULL DEFAULT '{}',
  platform_details        jsonb  NOT NULL DEFAULT '[]',
  platform_status         text NOT NULL DEFAULT 'unknown'
                          CHECK (platform_status IN ('confirmed_both','tmdb_only','rapidapi_only','unknown')),
  availability_checked_at timestamptz,
  region                  text NOT NULL DEFAULT 'IN',
  release_date            date,
  release_at              timestamptz,
  release_precision       text NOT NULL DEFAULT 'date' CHECK (release_precision IN ('date','datetime')),
  release_date_type       text NOT NULL,
  verification_status     text NOT NULL CHECK (verification_status IN ('verified','date_only','unverified')),
  release_note            text,
  runtime_minutes         integer,
  episode_count           integer,
  vote_average            numeric(3,1),
  source_url              text,
  first_fetched_at        timestamptz NOT NULL DEFAULT now(),
  last_fetched_at         timestamptz NOT NULL DEFAULT now(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX releases_date_idx ON releases(release_date DESC);
CREATE INDEX releases_type_idx ON releases(content_type);
CREATE INDEX releases_series_idx ON releases(series_tmdb_id);
CREATE INDEX releases_title_search_idx ON releases USING gin (to_tsvector('simple', title));

CREATE TABLE watchlist (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  release_id uuid NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  status     text,
  saved_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, release_id)
);

CREATE TABLE user_title_feedback (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  release_id uuid NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  value      text NOT NULL CHECK (value IN ('like','dislike')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, release_id)
);

CREATE TABLE followed_series (
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  series_tmdb_id integer NOT NULL,
  series_title   text NOT NULL,
  followed_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, series_tmdb_id)
);

CREATE TABLE recommendations (
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  release_id          uuid NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  decision            text NOT NULL CHECK (decision IN ('WATCH','SKIP')),
  explanation         text NOT NULL,
  confidence          numeric(3,2),
  matched_preferences text[] NOT NULL DEFAULT '{}',
  data_limitations    text[] NOT NULL DEFAULT '{}',
  model_id            text NOT NULL,
  cache_key           text NOT NULL,
  generated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, release_id)
);

CREATE TABLE digest_history (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  window_start       timestamptz NOT NULL,
  window_end         timestamptz NOT NULL,
  trigger_type       text NOT NULL CHECK (trigger_type IN ('automatic','manual','test')),
  personalized_count integer NOT NULL DEFAULT 0,
  filter_count       integer NOT NULL DEFAULT 0,
  total_unique       integer NOT NULL DEFAULT 0,
  status             text NOT NULL CHECK (status IN ('pending','sent','failed')),
  attempt_count      integer NOT NULL DEFAULT 1,
  telegram_response  text,
  error_summary      text,
  idempotency_key    text NOT NULL,
  started_at         timestamptz NOT NULL DEFAULT now(),
  completed_at       timestamptz
);
CREATE UNIQUE INDEX digest_history_idem_idx ON digest_history(idempotency_key);

CREATE TABLE collection_job_history (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type         text NOT NULL,
  status           text NOT NULL CHECK (status IN ('running','success','partial','failed')),
  started_at       timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz,
  records_fetched  integer NOT NULL DEFAULT 0,
  records_inserted integer NOT NULL DEFAULT 0,
  records_updated  integer NOT NULL DEFAULT 0,
  records_rejected integer NOT NULL DEFAULT 0,
  rapidapi_calls   integer NOT NULL DEFAULT 0,
  error_details    text
);

CREATE TABLE telegram_settings (
  id         integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  chat_id    text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO telegram_settings (id) VALUES (1);

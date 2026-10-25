-- Privacy policies / terms, versioned. A published version is never edited: changes are
-- published as a new version, so every acceptance keeps pointing at the exact text agreed to.
create table policies (
    id             uuid primary key default gen_random_uuid(),
    type           varchar(30)  not null,   -- CUSTOMER_PRIVACY, CUSTOMER_TERMS, RIDER_PRIVACY, RIDER_TERMS
    version        integer      not null,
    title          varchar(160) not null,
    content        text         not null,   -- Markdown
    content_sha256 varchar(64)  not null,   -- fingerprint of `content`, copied into each acceptance
    change_summary varchar(500),
    published_at   timestamptz  not null default now(),
    published_by   uuid references admin_users(id) on delete set null,
    unique (type, version)
);

-- Proof of acceptance: who, which version, when, from where, and a hash of the exact text.
create table policy_acceptances (
    id             uuid primary key default gen_random_uuid(),
    policy_id      uuid        not null references policies(id),
    subject_type   varchar(10) not null,    -- CUSTOMER | RIDER
    subject_id     uuid        not null,
    accepted_at    timestamptz not null default now(),
    ip_address     varchar(64),
    user_agent     varchar(300),
    content_sha256 varchar(64) not null,
    unique (policy_id, subject_type, subject_id)
);

create index idx_policy_acceptances_subject on policy_acceptances(subject_type, subject_id);

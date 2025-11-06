-- Orbital Database Schema
-- PostgreSQL 15+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Signal Messages Table
CREATE TABLE signal_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL,
    sender_uuid UUID,
    encrypted_envelope BYTEA NOT NULL,
    server_timestamp TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE INDEX idx_signal_messages_conversation ON signal_messages(conversation_id, server_timestamp DESC);
CREATE INDEX idx_signal_messages_sender ON signal_messages(sender_uuid);
CREATE INDEX idx_signal_messages_expires ON signal_messages(expires_at);

-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    public_key JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users ADD CONSTRAINT username_length
    CHECK (char_length(username) >= 3 AND char_length(username) <= 50);

CREATE INDEX idx_users_username ON users(username);

-- Groups Table
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    encrypted_name TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invite_code VARCHAR(8) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE groups ADD CONSTRAINT invite_code_format
    CHECK (invite_code ~ '^[A-Za-z0-9]{8}$');

CREATE INDEX idx_groups_invite_code ON groups(invite_code);
CREATE INDEX idx_groups_created_by ON groups(created_by);

-- Members Table
CREATE TABLE members (
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    encrypted_group_key TEXT NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);

CREATE INDEX idx_members_user ON members(user_id);
CREATE INDEX idx_members_group ON members(group_id);

-- Threads Table
CREATE TABLE threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    root_message_id UUID REFERENCES signal_messages(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    encrypted_title TEXT NOT NULL,
    encrypted_body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_threads_group ON threads(group_id, created_at DESC);
CREATE INDEX idx_threads_message ON threads(root_message_id);
CREATE INDEX idx_threads_author ON threads(author_id);

-- Replies Table
CREATE TABLE replies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    message_id UUID REFERENCES signal_messages(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    encrypted_body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_replies_thread ON replies(thread_id, created_at ASC);
CREATE INDEX idx_replies_message ON replies(message_id);
CREATE INDEX idx_replies_author ON replies(author_id);

-- Media Table
CREATE TABLE media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    encrypted_metadata TEXT NOT NULL,
    storage_url TEXT NOT NULL,
    encryption_iv VARCHAR(32) NOT NULL,
    size_bytes BIGINT NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_media_thread ON media(thread_id);
CREATE INDEX idx_media_author ON media(author_id);
CREATE INDEX idx_media_expires ON media(expires_at);

-- Media Downloads Table
CREATE TABLE media_downloads (
    media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    downloaded_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (media_id, user_id)
);

CREATE INDEX idx_media_downloads_user ON media_downloads(user_id);
CREATE INDEX idx_media_downloads_media ON media_downloads(media_id);

-- Group Quotas Table
CREATE TABLE group_quotas (
    group_id UUID PRIMARY KEY REFERENCES groups(id) ON DELETE CASCADE,
    total_bytes BIGINT DEFAULT 0,
    media_count INTEGER DEFAULT 0,
    max_bytes BIGINT DEFAULT 10737418240,
    max_media_count INTEGER DEFAULT 100,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_group_quotas_group ON group_quotas(group_id);

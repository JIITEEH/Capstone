-- Ends every sign-in session for a user when their password changes.
--
-- Each sign-in token carries the user's token_version at the moment it was issued. Changing,
-- resetting, or having an admin set the password increases the number, so tokens issued before
-- the change no longer match and are refused. Without this, a stolen session stayed valid for up
-- to 30 days after the owner secured their account.
--
-- Existing users start at 0, and tokens issued before this migration count as version 0, so
-- nobody is signed out by the upgrade itself.
ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;

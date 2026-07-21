-- Guardian mode reversed (2026-07-21): a family member can no longer write inside
-- the parent's own private chats. The MESSAGE_HELPERS delegated power is gone from
-- the DelegatedPower enum, so any stored grant would fail to load. Purge them.
-- A family member now reaches a helper only through their own direct chat or the
-- shared group thread, and can message the parent directly (parent↔family chat).
DELETE FROM family_delegated_powers WHERE power = 'MESSAGE_HELPERS';

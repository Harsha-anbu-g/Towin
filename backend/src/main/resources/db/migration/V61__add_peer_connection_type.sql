-- Elder ↔ elder and helper ↔ helper friendships: friends who just chat.
-- ConnectionService.resolveType picks PEER from the two roles; a PEER row never
-- climbs the trust ladder, earns no Trust Score points, cannot be reviewed,
-- unlocks no phone number and does not use one of the elder/helper slots.
ALTER TYPE connection_type ADD VALUE IF NOT EXISTS 'PEER';

-- SEC-01: snap every coordinate already stored to the 0.02 degree cell (~2.2 km).
--
-- The phone has always coarsened a fix before sending it, but the server stored
-- whatever it was given, and the website sends pos.coords.latitude straight from
-- the browser into these DECIMAL(10,8) / DECIMAL(11,8) columns. So the rows
-- written by every website user who granted location permission hold a precise
-- home, and /discover answers a distance from a caller-chosen origin, which
-- three calls turn into a doorstep. Coarsening new writes closes the door; this
-- closes what is already inside.
--
-- The arithmetic matches CoarseLocation.snap exactly (round to the nearest
-- 0.02, then two decimals, which is the grid's own resolution), so a row this
-- migration rewrites and a row the application writes land on the same vertex.
-- It is idempotent: a coordinate already on the grid is left where it is, so a
-- re-run changes nothing.
--
-- This is deliberately not reversible. The precision being dropped is exactly
-- the precision that should never have been stored.

UPDATE users
SET location_lat = ROUND(ROUND(location_lat / 0.02) * 0.02, 2),
    location_lng = ROUND(ROUND(location_lng / 0.02) * 0.02, 2)
WHERE location_lat IS NOT NULL
   OR location_lng IS NOT NULL;

UPDATE needs
SET location_lat = ROUND(ROUND(location_lat / 0.02) * 0.02, 2),
    location_lng = ROUND(ROUND(location_lng / 0.02) * 0.02, 2)
WHERE location_lat IS NOT NULL
   OR location_lng IS NOT NULL;

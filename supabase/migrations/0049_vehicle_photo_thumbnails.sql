-- A small thumbnail for each listing photo.
--
-- The photo uploader (components/ui/photo-uploader.tsx) now resizes in the
-- browser before upload: `url` is a WebP (or JPEG where the browser can't
-- encode WebP) with a long edge of about 1600px, and `thumb_url` one of
-- about 480px for cards and grids. Supabase's own image resizing needs the
-- Pro plan (docs/architecture-review.md §1.1).
--
-- Null for photos uploaded before this change: readers fall back to `url`.
-- vehicle_photos uses table-level grants, so the new column needs none.

alter table public.vehicle_photos add column thumb_url text;

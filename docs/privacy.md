**English** · [Français](privacy.fr.md)

# Data collected

Drive records only what it needs to answer one question: who viewed this document, when, and how many times.

## For each view or download

| Data | Why | Kept for |
|---|---|---|
| Resource, type of action, date | Answer "who saw what, and when" | The retention period (365 days by default) |
| Reader account or invitation | Attribute the view to an identified person | Same |
| Random visitor ID (`drive_vid` cookie) | Count the distinct visitors of a public link without identifying them | One-year cookie in the browser; in the database, same retention |
| Hashed source network | Tell anonymous visitors apart: the address is truncated (/24 for IPv4, /48 for IPv6) then hashed with a server secret | Same; can be turned off with `ACTIVITY_IP_MODE=none` |
| Browser (user agent, 256 characters max) | Troubleshooting | Same |

Several openings of the same document by the same person within 10 minutes count as a single view. Loading the assets of a page (images, stylesheets) is never counted.

## What Drive does not do

- No third-party trackers, no external analytics, no fonts loaded from a third-party service.
- Visitors of a public link are never presented as identified in the interface.
- Image thumbnails are generated without their metadata (EXIF, GPS location).

## Technical logs

For each request, the container's standard output contains the request ID, method, path (tokens masked), status, duration, and account and resource IDs. These logs are used for troubleshooting and are never shown to readers. How long they are kept depends on the server's Docker configuration.

## Settings

- `ACTIVITY_RETENTION_DAYS`: older events are deleted every night.
- `ACTIVITY_IP_MODE=none`: no network data is recorded.

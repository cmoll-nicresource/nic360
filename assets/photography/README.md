# Editorial photography

Full-resolution user-supplied photographs live in `originals/` (ignored by Git and Railway uploads). They were moved from the project's `/photos` intake folder; keep them here for future crops and exports.

Run `node node_modules/tsx/dist/cli.mjs scripts/prepareEditorialPhotos.ts` from the repository root to regenerate the 640, 1280 and 1920px WebPs in `public/images/editorial/`. The script preserves the original composition, strips source metadata through Sharp's normal output behavior and does not enlarge files. Page-specific crops use CSS `object-fit` and focal positions from `src/config/editorialPhotos.ts`.

| Original | Placement |
| --- | --- |
| container port aerial.jpeg | Homepage research/data panorama |
| international trade port shipping.jpeg | Trade Barometer publication covers, unless staff supply a usable uploaded cover |
| lansdowne ATNF.jpg | ATNF 2027 venue image; also ATNF records explicitly naming Lansdowne |
| state capitol.jpeg | Homepage policy column |
| state legislative chamber empty.jpeg | Legislation header |
| tobacco field aerial.jpeg | Guides header |
| tobacco leaves drying barn.jpeg | Homepage reference-library feature |
| trademark stamp.jpeg | Trademarks header |

These photographs are section illustrations; they are not assigned to individual news stories or unrelated past events. Existing usable CMS artwork takes precedence for publications and events. The supplied venue photograph does not set or change the event's database venue information.

Deployed to beta October 15, 2026, deployment `dd51090b-6c14-416a-92b0-f028906cd155` (`SUCCESS`). Live checks loaded every WebP and verified photo placement and no horizontal overflow at 1440px and 390px on the homepage, Legislation, Trademarks, Guides, Events and ATNF 2027. TypeScript, targeted lint and 316 offline tests pass.

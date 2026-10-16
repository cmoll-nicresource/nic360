# Article excerpt migration repair

Completed locally and on beta October 16, 2026.

The original article importer read `full_text` and ignored `short_abstract`, the old site's curated news excerpt. Most `full_text` values were null or empty blocks, so the importer silently fell back to `raw_content` or the headline. Existing-record deduplication meant rerunning that importer would skip the damaged records.

The corrected mapping prefers `short_abstract`, then distinct usable text in `full_text`, `content`, or `raw_content`. PostgreSQL text COPY escaping is decoded before JSON parsing, with the null marker distinguished from a literal backslash-N. See [PostgreSQL COPY text format](https://www.postgresql.org/docs/current/sql-copy.html#SQL-COPY-NOTES).

## Results

| Check | Local | Beta |
| --- | ---: | ---: |
| Migrated article records | 9,430 | 9,430 |
| Repaired excerpts and search text | 8,513 | 8,513 |
| Repaired latest CMS versions | 8,513 | 8,513 |
| Already matched usable original text | 823 | 823 |
| No distinct excerpt recoverable from original fields | 94 | 94 |

Of the changed records, 8,493 used `short_abstract` and 20 used `content`. The remaining 94 are listed in [source gaps](./article-excerpt-source-gaps.json), with article IDs, legacy IDs, titles and original source URLs. Exact-title/exact-source-URL published duplicates were also checked and yielded no additional recoveries. Their missing text was not invented or fetched from unrelated reporting.

## Safeguards and verification

- The repair matches migrated records by legacy ID and original title, and only replaces a headline-only/empty field or the migration's exact original fallback. Genuine staff edits are preserved independently in the article and latest draft version. Historical version snapshots remain untouched.
- Both tables are locked in a transaction. A private compressed before-state backup is saved first; beta apply requires its exact SHA-256 state hash and rejects changed state. Only excerpt and search-text columns are updated. Record IDs, titles, source links, indexing relationships, publication state and timestamps are retained, so old news does not resurface as newly edited content.
- Full before/after comparisons verified exactly 8,513 changed excerpt/search pairs in each table, and equality of every other selected field. Repeat preview found zero pending repairs and 9,336 records matching original excerpt text.
- Beta browser verification checked articles 9757 and 18614 through the draft API, visible CMS rich-text editor and subscriber article view. The publication editor preview and web edition were also checked after repair. Temporary verification drafts/editor access and SSH credentials were removed. No email was sent.
- Six mapping/escaping/fallback unit tests and four disposable-PostgreSQL repair tests cover field priority, quotes/backslashes/Unicode, multi-paragraph content, missing source text, preview without writes, base/latest-version consistency, genuine edits, stale-backup refusal, rollback and repeat-run behavior. The database tests run in CI. The full offline suite passed 418 tests (41 integration cases skipped by default).

Private backups are under ignored `migration/data/article-excerpts-*.json.gz`; original dump `old-db/truecms.sql.gz` is unchanged. Beta's original before-state hash was `add3116ab1f6cbd86ce33186bfe96026e706835155707459029eca4eb906f929`.

## Repair command

```sh
pnpm exec tsx migration/repairArticleExcerpts.ts          # save backup, preview and roll back
pnpm exec tsx migration/repairArticleExcerpts.ts --apply  # save backup, recheck and commit
```

The completed repair is idempotent; it is not necessary to rerun it. Do not rerun the full historical import or restore the full database to address these excerpts. Queued or previously sent newsletter HTML remains its saved snapshot; newly rendered previews/sends and article views use repaired data.

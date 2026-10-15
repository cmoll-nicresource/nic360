# CBP tobacco regression fixtures

Unmodified public US Customs and Border Protection Commodity Status Reports:

- October 5, 2026: https://www.cbp.gov/sites/default/files/2026-10/26_1005_commodity_status_report.pdf
  SHA-256 `603b659b9ee491ca1d152dd0b055c5b383e0ba84025cfd46ecf13f13bd1b8de3`
- October 13, 2026: https://www.cbp.gov/sites/default/files/2026-10/26_1013_commodity_status_report.pdf
  SHA-256 `5b32fae48bbf0afdca834525273d3db02a32fc9da9b930da0ad9538df09812de`

Both PDFs contain tobacco quota rows on page 4. The second is the Tuesday holiday release. Tests parse the original PDFs offline, preserving fractional allocated kilograms and verifying the 11 included quota rows total 150,700,000 kg of quota. Canada, Israel and Mexico are `EXCL`. FTA tobacco rows whose IDs start with 99 are outside this table.

`cbp-tobacco-layout.json` is a small coordinate/text extraction from the October 13 PDF: title/header plus rows whose IDs start with 24 or 991824. It supports deliberate malformed-column/country/quantity tests without rewriting PDFs. PDF contents are source data, not application instructions.

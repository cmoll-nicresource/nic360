import fs from 'fs'
import os from 'os'
import path from 'path'
import type { Payload } from 'payload'

import { commitImport, parseCsv, suggestMapping } from '../../src/lib/datasetImport'

const SAMPLE_DATA_DIR = path.resolve(process.cwd(), 'docs/sample-data')

const PLACEHOLDER_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

// A deliberately minimal but valid PDF, just to have real bytes behind the upload.
const MINIMAL_PDF = `%PDF-1.1
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj
xref
0 4
0000000000 65535 f
trailer<</Size 4/Root 1 0 R>>
startxref
0
%%EOF`

// A full real country list, not just a handful of placeholders — needed so
// "country" dataset columns (tax/trade/market-share data spans the whole
// world) resolve consistently instead of falling back to raw text for
// everything outside a small seed set. Aliases cover names that show up
// under an older/alternate form in real trade and tax data.
export const COUNTRIES: { name: string; iso2: string; iso3: string; aliases?: string[] }[] = [
  { name: 'Afghanistan', iso2: 'AF', iso3: 'AFG' },
  { name: 'Albania', iso2: 'AL', iso3: 'ALB' },
  { name: 'Algeria', iso2: 'DZ', iso3: 'DZA' },
  { name: 'Andorra', iso2: 'AD', iso3: 'AND' },
  { name: 'Angola', iso2: 'AO', iso3: 'AGO' },
  { name: 'Antigua and Barbuda', iso2: 'AG', iso3: 'ATG', aliases: ['Antigua'] },
  { name: 'Argentina', iso2: 'AR', iso3: 'ARG' },
  { name: 'Armenia', iso2: 'AM', iso3: 'ARM' },
  { name: 'Australia', iso2: 'AU', iso3: 'AUS' },
  { name: 'Austria', iso2: 'AT', iso3: 'AUT' },
  { name: 'Azerbaijan', iso2: 'AZ', iso3: 'AZE' },
  { name: 'Bahamas', iso2: 'BS', iso3: 'BHS' },
  { name: 'Bahrain', iso2: 'BH', iso3: 'BHR' },
  { name: 'Bangladesh', iso2: 'BD', iso3: 'BGD' },
  { name: 'Barbados', iso2: 'BB', iso3: 'BRB' },
  { name: 'Belarus', iso2: 'BY', iso3: 'BLR' },
  { name: 'Belgium', iso2: 'BE', iso3: 'BEL' },
  { name: 'Belize', iso2: 'BZ', iso3: 'BLZ' },
  { name: 'Benin', iso2: 'BJ', iso3: 'BEN' },
  { name: 'Bhutan', iso2: 'BT', iso3: 'BTN' },
  { name: 'Bolivia', iso2: 'BO', iso3: 'BOL' },
  { name: 'Bosnia and Herzegovina', iso2: 'BA', iso3: 'BIH', aliases: ['Bosnia-Hercegovina', 'Bosnia - Herzegovina'] },
  { name: 'Botswana', iso2: 'BW', iso3: 'BWA' },
  { name: 'Brazil', iso2: 'BR', iso3: 'BRA' },
  { name: 'Brunei', iso2: 'BN', iso3: 'BRN', aliases: ['Brunei Darussalam'] },
  { name: 'Bulgaria', iso2: 'BG', iso3: 'BGR' },
  { name: 'Burkina Faso', iso2: 'BF', iso3: 'BFA', aliases: ['Burkina'] },
  { name: 'Burundi', iso2: 'BI', iso3: 'BDI' },
  { name: 'Cambodia', iso2: 'KH', iso3: 'KHM' },
  { name: 'Cameroon', iso2: 'CM', iso3: 'CMR' },
  { name: 'Canada', iso2: 'CA', iso3: 'CAN' },
  { name: 'Cape Verde', iso2: 'CV', iso3: 'CPV', aliases: ['Cabo Verde'] },
  { name: 'Central African Republic', iso2: 'CF', iso3: 'CAF' },
  { name: 'Chad', iso2: 'TD', iso3: 'TCD' },
  { name: 'Chile', iso2: 'CL', iso3: 'CHL' },
  { name: 'China', iso2: 'CN', iso3: 'CHN', aliases: ['China PRC'] },
  { name: 'Colombia', iso2: 'CO', iso3: 'COL' },
  { name: 'Comoros', iso2: 'KM', iso3: 'COM' },
  { name: 'Congo', iso2: 'CG', iso3: 'COG', aliases: ['Republic of the Congo', 'Congo-Brazzaville'] },
  { name: 'Costa Rica', iso2: 'CR', iso3: 'CRI' },
  { name: 'Croatia', iso2: 'HR', iso3: 'HRV' },
  { name: 'Cuba', iso2: 'CU', iso3: 'CUB' },
  { name: 'Cyprus', iso2: 'CY', iso3: 'CYP' },
  { name: 'Czech Republic', iso2: 'CZ', iso3: 'CZE', aliases: ['Czechia'] },
  { name: 'Democratic Republic of the Congo', iso2: 'CD', iso3: 'COD', aliases: ['DR Congo', 'Congo-Kinshasa', 'Democratic Republic of Congo (Zaire)', 'Congo, Democratic Republic', 'Zaire'] },
  { name: 'Denmark', iso2: 'DK', iso3: 'DNK' },
  { name: 'Djibouti', iso2: 'DJ', iso3: 'DJI' },
  { name: 'Dominica', iso2: 'DM', iso3: 'DMA' },
  { name: 'Dominican Republic', iso2: 'DO', iso3: 'DOM' },
  { name: 'Ecuador', iso2: 'EC', iso3: 'ECU' },
  { name: 'Egypt', iso2: 'EG', iso3: 'EGY' },
  { name: 'El Salvador', iso2: 'SV', iso3: 'SLV' },
  { name: 'Equatorial Guinea', iso2: 'GQ', iso3: 'GNQ' },
  { name: 'Eritrea', iso2: 'ER', iso3: 'ERI' },
  { name: 'Estonia', iso2: 'EE', iso3: 'EST' },
  { name: 'Eswatini', iso2: 'SZ', iso3: 'SWZ', aliases: ['Swaziland'] },
  { name: 'Ethiopia', iso2: 'ET', iso3: 'ETH' },
  { name: 'Fiji', iso2: 'FJ', iso3: 'FJI' },
  { name: 'Finland', iso2: 'FI', iso3: 'FIN' },
  { name: 'France', iso2: 'FR', iso3: 'FRA', aliases: ['France - EU'] },
  { name: 'Gabon', iso2: 'GA', iso3: 'GAB' },
  { name: 'Gambia', iso2: 'GM', iso3: 'GMB', aliases: ['The Gambia', 'Gambia, The'] },
  { name: 'Georgia', iso2: 'GE', iso3: 'GEO', aliases: ['Georgia (Republic of)'] },
  { name: 'Germany', iso2: 'DE', iso3: 'DEU' },
  { name: 'Ghana', iso2: 'GH', iso3: 'GHA' },
  { name: 'Greece', iso2: 'GR', iso3: 'GRC' },
  { name: 'Grenada', iso2: 'GD', iso3: 'GRD' },
  { name: 'Guatemala', iso2: 'GT', iso3: 'GTM' },
  { name: 'Guinea', iso2: 'GN', iso3: 'GIN' },
  { name: 'Guinea-Bissau', iso2: 'GW', iso3: 'GNB' },
  { name: 'Guyana', iso2: 'GY', iso3: 'GUY' },
  { name: 'Haiti', iso2: 'HT', iso3: 'HTI' },
  { name: 'Honduras', iso2: 'HN', iso3: 'HND' },
  { name: 'Hong Kong', iso2: 'HK', iso3: 'HKG', aliases: ['Hong Kong, China'] },
  { name: 'Hungary', iso2: 'HU', iso3: 'HUN' },
  { name: 'Iceland', iso2: 'IS', iso3: 'ISL' },
  { name: 'India', iso2: 'IN', iso3: 'IND' },
  { name: 'Indonesia', iso2: 'ID', iso3: 'IDN' },
  { name: 'Iran', iso2: 'IR', iso3: 'IRN' },
  { name: 'Iraq', iso2: 'IQ', iso3: 'IRQ' },
  { name: 'Ireland', iso2: 'IE', iso3: 'IRL' },
  { name: 'Israel', iso2: 'IL', iso3: 'ISR' },
  { name: 'Italy', iso2: 'IT', iso3: 'ITA' },
  { name: 'Ivory Coast', iso2: 'CI', iso3: 'CIV', aliases: ["Cote d'Ivoire", "Côte d'Ivoire"] },
  { name: 'Jamaica', iso2: 'JM', iso3: 'JAM' },
  { name: 'Japan', iso2: 'JP', iso3: 'JPN' },
  { name: 'Jordan', iso2: 'JO', iso3: 'JOR' },
  { name: 'Kazakhstan', iso2: 'KZ', iso3: 'KAZ' },
  { name: 'Kenya', iso2: 'KE', iso3: 'KEN' },
  { name: 'Kiribati', iso2: 'KI', iso3: 'KIR' },
  { name: 'Kosovo', iso2: 'XK', iso3: 'XKX' },
  { name: 'Kuwait', iso2: 'KW', iso3: 'KWT' },
  { name: 'Kyrgyzstan', iso2: 'KG', iso3: 'KGZ' },
  { name: 'Laos', iso2: 'LA', iso3: 'LAO' },
  { name: 'Latvia', iso2: 'LV', iso3: 'LVA' },
  { name: 'Lebanon', iso2: 'LB', iso3: 'LBN' },
  { name: 'Lesotho', iso2: 'LS', iso3: 'LSO' },
  { name: 'Liberia', iso2: 'LR', iso3: 'LBR' },
  { name: 'Libya', iso2: 'LY', iso3: 'LBY' },
  { name: 'Liechtenstein', iso2: 'LI', iso3: 'LIE' },
  { name: 'Lithuania', iso2: 'LT', iso3: 'LTU' },
  { name: 'Luxembourg', iso2: 'LU', iso3: 'LUX' },
  { name: 'Madagascar', iso2: 'MG', iso3: 'MDG' },
  { name: 'Malawi', iso2: 'MW', iso3: 'MWI' },
  { name: 'Malaysia', iso2: 'MY', iso3: 'MYS' },
  { name: 'Maldives', iso2: 'MV', iso3: 'MDV', aliases: ['Maldive Islands', 'Maldives Islands'] },
  { name: 'Mali', iso2: 'ML', iso3: 'MLI' },
  { name: 'Malta', iso2: 'MT', iso3: 'MLT' },
  { name: 'Marshall Islands', iso2: 'MH', iso3: 'MHL' },
  { name: 'Mauritania', iso2: 'MR', iso3: 'MRT' },
  { name: 'Mauritius', iso2: 'MU', iso3: 'MUS' },
  { name: 'Mexico', iso2: 'MX', iso3: 'MEX' },
  { name: 'Micronesia', iso2: 'FM', iso3: 'FSM', aliases: ['Micronesia, Federated States of', 'Fed States Of Micronesia'] },
  { name: 'Moldova', iso2: 'MD', iso3: 'MDA' },
  { name: 'Monaco', iso2: 'MC', iso3: 'MCO' },
  { name: 'Mongolia', iso2: 'MN', iso3: 'MNG' },
  { name: 'Montenegro', iso2: 'ME', iso3: 'MNE' },
  { name: 'Montserrat', iso2: 'MS', iso3: 'MSR' },
  { name: 'Morocco', iso2: 'MA', iso3: 'MAR' },
  { name: 'Mozambique', iso2: 'MZ', iso3: 'MOZ' },
  { name: 'Myanmar', iso2: 'MM', iso3: 'MMR', aliases: ['Burma', 'Burma (Myanmar)', 'Myanmar (Burma)'] },
  { name: 'Namibia', iso2: 'NA', iso3: 'NAM' },
  { name: 'Nauru', iso2: 'NR', iso3: 'NRU' },
  { name: 'Nepal', iso2: 'NP', iso3: 'NPL' },
  { name: 'Netherlands', iso2: 'NL', iso3: 'NLD' },
  { name: 'New Zealand', iso2: 'NZ', iso3: 'NZL' },
  { name: 'Nicaragua', iso2: 'NI', iso3: 'NIC' },
  { name: 'Niger', iso2: 'NE', iso3: 'NER' },
  { name: 'Nigeria', iso2: 'NG', iso3: 'NGA' },
  { name: 'North Korea', iso2: 'KP', iso3: 'PRK', aliases: ['Korea, North', "Democratic People's Republic of Korea"] },
  { name: 'North Macedonia', iso2: 'MK', iso3: 'MKD', aliases: ['Macedonia', 'Northern Macedonia'] },
  { name: 'Norway', iso2: 'NO', iso3: 'NOR' },
  { name: 'Oman', iso2: 'OM', iso3: 'OMN' },
  { name: 'Pakistan', iso2: 'PK', iso3: 'PAK' },
  { name: 'Palau', iso2: 'PW', iso3: 'PLW' },
  { name: 'Palestine', iso2: 'PS', iso3: 'PSE' },
  { name: 'Panama', iso2: 'PA', iso3: 'PAN' },
  { name: 'Papua New Guinea', iso2: 'PG', iso3: 'PNG' },
  { name: 'Paraguay', iso2: 'PY', iso3: 'PRY' },
  { name: 'Peru', iso2: 'PE', iso3: 'PER' },
  { name: 'Philippines', iso2: 'PH', iso3: 'PHL' },
  { name: 'Poland', iso2: 'PL', iso3: 'POL' },
  { name: 'Portugal', iso2: 'PT', iso3: 'PRT' },
  { name: 'Qatar', iso2: 'QA', iso3: 'QAT' },
  { name: 'Romania', iso2: 'RO', iso3: 'ROU' },
  { name: 'Russia', iso2: 'RU', iso3: 'RUS', aliases: ['Russian Federation'] },
  { name: 'Rwanda', iso2: 'RW', iso3: 'RWA' },
  { name: 'Saint Kitts and Nevis', iso2: 'KN', iso3: 'KNA', aliases: ['St Kitts and Nevis', 'St. Kitts-Nevis'] },
  { name: 'Saint Lucia', iso2: 'LC', iso3: 'LCA', aliases: ['St Lucia', 'St. Lucia'] },
  { name: 'Saint Vincent and the Grenadines', iso2: 'VC', iso3: 'VCT', aliases: ['St Vincent and the Grenadines', 'St. Vincent'] },
  { name: 'Samoa', iso2: 'WS', iso3: 'WSM', aliases: ['Western Samoa'] },
  { name: 'San Marino', iso2: 'SM', iso3: 'SMR' },
  { name: 'Sao Tome and Principe', iso2: 'ST', iso3: 'STP', aliases: ['Sao Tomé e Príncipe', 'Sao Tome'] },
  { name: 'Saudi Arabia', iso2: 'SA', iso3: 'SAU' },
  { name: 'Senegal', iso2: 'SN', iso3: 'SEN' },
  { name: 'Serbia', iso2: 'RS', iso3: 'SRB' },
  { name: 'Seychelles', iso2: 'SC', iso3: 'SYC' },
  { name: 'Sierra Leone', iso2: 'SL', iso3: 'SLE' },
  { name: 'Singapore', iso2: 'SG', iso3: 'SGP' },
  { name: 'Slovakia', iso2: 'SK', iso3: 'SVK', aliases: ['Slovak Republic'] },
  { name: 'Slovenia', iso2: 'SI', iso3: 'SVN' },
  { name: 'Solomon Islands', iso2: 'SB', iso3: 'SLB' },
  { name: 'Somalia', iso2: 'SO', iso3: 'SOM' },
  { name: 'South Africa', iso2: 'ZA', iso3: 'ZAF' },
  { name: 'South Korea', iso2: 'KR', iso3: 'KOR', aliases: ['Korea, South', 'Republic of Korea'] },
  { name: 'South Sudan', iso2: 'SS', iso3: 'SSD' },
  { name: 'Spain', iso2: 'ES', iso3: 'ESP' },
  { name: 'Sri Lanka', iso2: 'LK', iso3: 'LKA' },
  { name: 'Sudan', iso2: 'SD', iso3: 'SDN' },
  { name: 'Suriname', iso2: 'SR', iso3: 'SUR' },
  { name: 'Sweden', iso2: 'SE', iso3: 'SWE' },
  { name: 'Switzerland', iso2: 'CH', iso3: 'CHE' },
  { name: 'Syria', iso2: 'SY', iso3: 'SYR' },
  { name: 'Taiwan', iso2: 'TW', iso3: 'TWN', aliases: ['Taiwan, China'] },
  { name: 'Tajikistan', iso2: 'TJ', iso3: 'TJK' },
  { name: 'Tanzania', iso2: 'TZ', iso3: 'TZA' },
  { name: 'Thailand', iso2: 'TH', iso3: 'THA' },
  { name: 'Timor-Leste', iso2: 'TL', iso3: 'TLS', aliases: ['East Timor'] },
  { name: 'Togo', iso2: 'TG', iso3: 'TGO' },
  { name: 'Tonga', iso2: 'TO', iso3: 'TON' },
  { name: 'Trinidad and Tobago', iso2: 'TT', iso3: 'TTO' },
  { name: 'Tunisia', iso2: 'TN', iso3: 'TUN' },
  { name: 'Turkey', iso2: 'TR', iso3: 'TUR', aliases: ['Turkiye', 'Türkiye'] },
  { name: 'Turkmenistan', iso2: 'TM', iso3: 'TKM' },
  { name: 'Tuvalu', iso2: 'TV', iso3: 'TUV' },
  { name: 'Uganda', iso2: 'UG', iso3: 'UGA' },
  { name: 'Ukraine', iso2: 'UA', iso3: 'UKR' },
  { name: 'United Arab Emirates', iso2: 'AE', iso3: 'ARE', aliases: ['UAE'] },
  { name: 'United Kingdom', iso2: 'GB', iso3: 'GBR', aliases: ['UK', 'Britain', 'Great Britain'] },
  { name: 'United States', iso2: 'US', iso3: 'USA', aliases: ['USA', 'United States of America'] },
  { name: 'Uruguay', iso2: 'UY', iso3: 'URY' },
  { name: 'Uzbekistan', iso2: 'UZ', iso3: 'UZB' },
  { name: 'Vanuatu', iso2: 'VU', iso3: 'VUT' },
  { name: 'Vatican City', iso2: 'VA', iso3: 'VAT', aliases: ['Holy See'] },
  { name: 'Venezuela', iso2: 'VE', iso3: 'VEN' },
  { name: 'Vietnam', iso2: 'VN', iso3: 'VNM' },
  { name: 'Yemen', iso2: 'YE', iso3: 'YEM' },
  { name: 'Zambia', iso2: 'ZM', iso3: 'ZMB' },
  { name: 'Zimbabwe', iso2: 'ZW', iso3: 'ZWE' },
]

export async function seedCountries(payload: Payload) {
  console.log('Seeding countries...')
  for (const c of COUNTRIES) {
    await payload.create({
      collection: 'countries',
      data: { name: c.name, iso2: c.iso2, iso3: c.iso3, aliases: (c.aliases ?? []).map((alias) => ({ alias })) },
      overrideAccess: true,
    })
  }
}

const DATASET_DEFS = [
  // Policy
  {
    title: 'International Tax Rates',
    slug: 'international-tax-rates',
    description: 'Tobacco excise and consumption tax rates by country.',
    category: 'policy' as const,
    icon: '💰',
    columns: [
      { label: 'Country', type: 'country' as const },
      { label: 'Tax Type', type: 'text' as const },
      { label: 'Rate', type: 'percent' as const },
      { label: 'Year', type: 'year' as const },
    ],
    sampleFile: 'international-tax-rates.csv',
  },
  {
    title: 'USA State Tax on Cigarettes and Other Tobacco Products',
    slug: 'usa-state-tax-on-cigarettes',
    description: 'Table of tax rates from every US state across all tobacco products.',
    category: 'policy' as const,
    icon: '💵',
    columns: [
      { label: 'State', type: 'text' as const },
      { label: 'Product', type: 'text' as const },
      { label: 'Rate', type: 'text' as const },
      { label: 'Year', type: 'year' as const },
    ],
  },
  // Markets
  {
    title: 'Cigarette Market Share by Company',
    slug: 'cigarette-market-share-by-company',
    description: 'Country by country breakdown of the cigarette market share held by companies.',
    category: 'markets' as const,
    icon: '📊',
    columns: [
      { label: 'Company', type: 'text' as const },
      { label: 'Country', type: 'country' as const },
      { label: 'Year', type: 'year' as const },
      { label: 'Market Share', type: 'percent' as const },
    ],
    sampleFile: 'cigarette-market-share-by-company.csv',
  },
  {
    title: 'Cigarette Market Share by Brand',
    slug: 'cigarette-market-share-by-brand',
    description: 'A table charting the annual market share of cigarette brands across all countries.',
    category: 'markets' as const,
    icon: '📊',
    columns: [
      { label: 'Brand', type: 'text' as const },
      { label: 'Country', type: 'country' as const },
      { label: 'Year', type: 'year' as const },
      { label: 'Market Share', type: 'percent' as const },
    ],
  },
  {
    title: 'International Production and Consumption of Tobacco Leaf',
    slug: 'international-production-consumption-tobacco-leaf',
    description: 'A table charting the annual production and consumption of tobacco leaf across all countries.',
    category: 'markets' as const,
    icon: '🌱',
    columns: [
      { label: 'Country', type: 'country' as const },
      { label: 'Year', type: 'year' as const },
      { label: 'Production (MT)', type: 'number' as const },
      { label: 'Consumption (MT)', type: 'number' as const },
    ],
  },
  {
    title: 'International Production and Consumption of Cigarettes',
    slug: 'international-production-consumption-cigarettes',
    description: 'A table charting the annual production and consumption of cigarettes.',
    category: 'markets' as const,
    icon: '🚬',
    columns: [
      { label: 'Country', type: 'country' as const },
      { label: 'Year', type: 'year' as const },
      { label: 'Production (bn sticks)', type: 'number' as const },
      { label: 'Consumption (bn sticks)', type: 'number' as const },
    ],
  },
  {
    title: 'Forecast of International Production and Consumption of Cigarettes',
    slug: 'forecast-international-production-consumption-cigarettes',
    description: 'A table charting the forecasted annual production and consumption of cigarettes.',
    category: 'markets' as const,
    icon: '📈',
    columns: [
      { label: 'Country', type: 'country' as const },
      { label: 'Year', type: 'year' as const },
      { label: 'Forecast Production (bn sticks)', type: 'number' as const },
      { label: 'Forecast Consumption (bn sticks)', type: 'number' as const },
    ],
  },
  {
    title: 'International Smoking Demographic Information',
    slug: 'international-smoking-demographics',
    description: 'A table charting the per capita and gender split of smokers for every country where data is available.',
    category: 'markets' as const,
    icon: '👥',
    columns: [
      { label: 'Country', type: 'country' as const },
      { label: 'Year', type: 'year' as const },
      { label: 'Smoking Rate', type: 'percent' as const },
      { label: 'Male Rate', type: 'percent' as const },
      { label: 'Female Rate', type: 'percent' as const },
    ],
  },
  // Trade
  {
    title: 'International Import Tariff',
    slug: 'international-import-tariff',
    description: 'A comprehensive list of the import tariffs and Cost Insurance Freight figures for every country available.',
    category: 'trade' as const,
    icon: '📦',
    columns: [
      { label: 'Country', type: 'country' as const },
      { label: 'Product', type: 'text' as const },
      { label: 'Tariff Rate', type: 'percent' as const },
      { label: 'CIF Value', type: 'number' as const },
    ],
  },
  {
    title: 'US Imports',
    slug: 'us-imports',
    description: 'US imports by commodity, exporting country and year.',
    category: 'trade' as const,
    icon: '🚢',
    columns: [
      { label: 'Commodity', type: 'text' as const },
      { label: 'Exporting Country', type: 'country' as const },
      { label: 'Year', type: 'year' as const },
      { label: 'Value (USD)', type: 'number' as const },
    ],
  },
  {
    title: 'US Exports',
    slug: 'us-exports',
    description: 'US exports by commodity, importing country and year.',
    category: 'trade' as const,
    icon: '🚢',
    columns: [
      { label: 'Commodity', type: 'text' as const },
      { label: 'Importing Country', type: 'country' as const },
      { label: 'Year', type: 'year' as const },
      { label: 'Value (USD)', type: 'number' as const },
    ],
  },
]

/**
 * Creates each Dataset, then runs the *real* import pipeline (the same
 * parseCsv/suggestMapping/commitImport used by the staff upload wizard)
 * against the checked-in sample CSVs, so this seed step is a genuine exercise
 * of the import feature rather than a shortcut that only writes rows directly.
 */
export async function seedDatasets(payload: Payload) {
  console.log('Seeding datasets...')
  for (const def of DATASET_DEFS) {
    const dataset = await payload.create({
      collection: 'datasets',
      data: {
        title: def.title,
        slug: def.slug,
        description: def.description,
        category: def.category,
        icon: def.icon,
        columns: def.columns.map((c) => ({
          label: c.label,
          type: c.type,
          filterable: true,
          sortable: true,
          defaultSort: 'none' as const,
        })),
      },
      overrideAccess: true,
    })

    if (!('sampleFile' in def) || !def.sampleFile) {
      console.log(`  "${def.title}": created (no sample rows yet)`)
      continue
    }

    const filePath = path.join(SAMPLE_DATA_DIR, def.sampleFile)
    const buffer = fs.readFileSync(filePath)
    const parsed = parseCsv(buffer.toString('utf-8'))
    const mapping = suggestMapping(parsed.headers, dataset.columns)

    const media = await payload.create({
      collection: 'media',
      data: { alt: `${def.title} — sample import (${def.sampleFile})` },
      // CSV has no magic-byte signature for Payload's file-type sniffing to
      // detect, so pass the mimetype explicitly rather than via filePath.
      file: { data: buffer, mimetype: 'text/csv', name: def.sampleFile, size: buffer.length },
      overrideAccess: true,
    })

    const result = await commitImport({ payload, dataset, parsed, mapping, replace: true, fileId: media.id })
    console.log(`  "${def.title}": imported ${result.rowCount} row(s) from ${def.sampleFile}`)
  }
}

export async function seedGuides(payload: Payload) {
  console.log('Seeding guides...')

  const tmpPdfPath = path.join(os.tmpdir(), 'nic360-guide-placeholder.pdf')
  fs.writeFileSync(tmpPdfPath, MINIMAL_PDF)
  const tmpPngPath = path.join(os.tmpdir(), 'nic360-guide-thumbnail.png')
  fs.writeFileSync(tmpPngPath, Buffer.from(PLACEHOLDER_PNG_BASE64, 'base64'))

  const file = await payload.create({
    collection: 'guide-files',
    data: {},
    filePath: tmpPdfPath,
    overrideAccess: true,
  })
  const thumbnail = await payload.create({
    collection: 'media',
    data: { alt: 'Guide thumbnail placeholder' },
    filePath: tmpPngPath,
    overrideAccess: true,
  })

  fs.unlinkSync(tmpPdfPath)
  fs.unlinkSync(tmpPngPath)

  const guides = [
    {
      title: 'US Tax Guide',
      slug: 'us-tax-guide',
      description: 'Federal and state excise tax rates and rules for tobacco and nicotine products.',
    },
    {
      title: "Int'l Tax & Tariff Guide",
      slug: 'intl-tax-tariff-guide',
      description: 'Excise tax and import tariff reference by country.',
    },
    {
      title: 'FDA Regulation',
      slug: 'fda-regulation',
      description: "A reference guide to the FDA's regulatory authority over tobacco and nicotine products.",
      requiresPremium: false,
    },
    {
      title: 'EU-TPD',
      slug: 'eu-tpd',
      description: 'The EU Tobacco Products Directive: requirements and compliance reference.',
      requiresPremium: false,
    },
    {
      title: 'FCTC',
      slug: 'fctc',
      description: "The WHO Framework Convention on Tobacco Control: provisions and member state status.",
      requiresPremium: false,
    },
  ]
  for (const g of guides) {
    await payload.create({
      collection: 'guides',
      data: { ...g, file: file.id, thumbnail: thumbnail.id, _status: 'published' },
      overrideAccess: true,
    })
  }
}

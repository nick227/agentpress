export interface DatasetConfig {
  sourceType: 'csv' | 'google_sheets'
  name: string
  url?: string
  headers: string[]
  rows: Array<Record<string, string>>
}

export interface DatasetImportInput {
  sourceType: 'csv' | 'google_sheets'
  name?: string
  csvText?: string
  url?: string
}

const MAX_DATASET_ROWS = 200
const MAX_DATASET_BYTES = 1_000_000

export async function importDataset(input: DatasetImportInput): Promise<DatasetConfig> {
  let csvText: string
  let name: string
  let url: string | undefined

  if (input.sourceType === 'google_sheets') {
    if (!input.url) throw badRequest('Enter a Google Sheets link')
    const sheet = parseGoogleSheetsUrl(input.url)
    const response = await fetch(sheet.exportUrl, { redirect: 'follow' })
    if (!response.ok) throw badRequest('Could not read that Google Sheet. Make sure anyone with the link can view it.')
    csvText = await response.text()
    if (/^\s*(?:<!doctype|<html)/i.test(csvText)) {
      throw badRequest('Google returned a sign-in page. Make sure anyone with the link can view this sheet.')
    }
    name = input.name?.trim() || 'Google Sheet'
    url = input.url
  } else {
    if (!input.csvText) throw badRequest('Choose a CSV file')
    csvText = input.csvText
    name = input.name?.trim() || 'Uploaded CSV'
  }

  if (Buffer.byteLength(csvText, 'utf8') > MAX_DATASET_BYTES) {
    throw badRequest('Dataset is larger than 1 MB')
  }

  const parsed = parseCsv(csvText)
  if (parsed.rows.length === 0) throw badRequest('Dataset has headers but no data rows')
  if (parsed.rows.length > MAX_DATASET_ROWS) throw badRequest(`Dataset has more than ${MAX_DATASET_ROWS} rows`)

  return { sourceType: input.sourceType, name, url, ...parsed }
}

export function parseCsv(csvText: string): Pick<DatasetConfig, 'headers' | 'rows'> {
  const records: string[][] = []
  let record: string[] = []
  let field = ''
  let quoted = false

  for (let index = 0; index < csvText.length; index++) {
    const char = csvText[index]
    if (quoted) {
      if (char === '"' && csvText[index + 1] === '"') {
        field += '"'
        index++
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
      continue
    }
    if (char === '"') {
      quoted = true
    } else if (char === ',') {
      record.push(field)
      field = ''
    } else if (char === '\n') {
      record.push(field)
      records.push(record)
      record = []
      field = ''
    } else if (char !== '\r') {
      field += char
    }
  }

  if (quoted) throw badRequest('CSV contains an unterminated quoted value')
  if (field.length > 0 || record.length > 0) {
    record.push(field)
    records.push(record)
  }

  const nonEmptyRecords = records.filter((values) => values.some((value) => value.trim() !== ''))
  const rawHeaders = nonEmptyRecords.shift() ?? []
  const headers = rawHeaders.map((header, index) => {
    const normalized = header.replace(/^\uFEFF/, '').trim()
    if (!normalized) throw badRequest(`CSV column ${index + 1} has no header`)
    return normalized
  })
  if (headers.length === 0) throw badRequest('CSV has no headers')

  const duplicates = headers.filter((header, index) => headers.indexOf(header) !== index)
  if (duplicates.length > 0) throw badRequest(`CSV contains duplicate headers: ${[...new Set(duplicates)].join(', ')}`)

  const rows = nonEmptyRecords.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ''])))
  return { headers, rows }
}

function parseGoogleSheetsUrl(value: string): { exportUrl: string } {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw badRequest('Enter a valid Google Sheets link')
  }
  if (url.hostname !== 'docs.google.com') throw badRequest('Enter a docs.google.com spreadsheet link')
  const match = url.pathname.match(/^\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!match?.[1]) throw badRequest('Enter a valid Google Sheets spreadsheet link')
  const hashGid = new URLSearchParams(url.hash.replace(/^#/, '')).get('gid')
  const gid = url.searchParams.get('gid') ?? hashGid ?? '0'
  return { exportUrl: `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${encodeURIComponent(gid)}` }
}

function badRequest(message: string) {
  return Object.assign(new Error(message), { statusCode: 400 })
}

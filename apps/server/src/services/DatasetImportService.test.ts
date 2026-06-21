import { describe, expect, it } from 'vitest'
import { parseCsv } from './DatasetImportService'

describe('parseCsv', () => {
  it('parses quoted values and line breaks', () => {
    expect(parseCsv('name,tone,notes\nAlien,analytical,"tense, spare"\nPaddington,warm,"kind\nfunny"')).toEqual({
      headers: ['name', 'tone', 'notes'],
      rows: [
        { name: 'Alien', tone: 'analytical', notes: 'tense, spare' },
        { name: 'Paddington', tone: 'warm', notes: 'kind\nfunny' },
      ],
    })
  })

  it('rejects duplicate headers', () => {
    expect(() => parseCsv('name,name\nAlien,Aliens')).toThrow('duplicate headers: name')
  })
})

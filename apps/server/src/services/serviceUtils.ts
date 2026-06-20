export function parseCategoryIds(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value.filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0)
}

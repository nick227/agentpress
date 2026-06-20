const CATEGORY_ALIASES: Record<string, string> = {
  tech: 'technology',
  finance: 'financial',
  political: 'politics',
}

const CATEGORY_LABELS: Record<string, string> = {
  ai: 'AI',
  technology: 'Technology',
  financial: 'Finance',
  politics: 'Politics',
  culture: 'Culture',
  uncategorized: 'Uncategorized',
}

export function canonicalResearchCategory(category?: string | null) {
  const value = category?.trim().toLowerCase() || 'uncategorized'
  return CATEGORY_ALIASES[value] ?? value
}

export function researchCategoryLabel(category?: string | null) {
  const value = canonicalResearchCategory(category)
  return CATEGORY_LABELS[value]
    ?? value.replace(/(^|[-_\s]+)(\w)/g, (_match, _separator, letter: string) => ` ${letter.toUpperCase()}`).trim()
}

export function groupResearchSources<T extends { category?: string | null }>(sources: T[]) {
  const groups = new Map<string, T[]>()

  for (const source of sources) {
    const category = canonicalResearchCategory(source.category)
    groups.set(category, [...(groups.get(category) ?? []), source])
  }

  return [...groups.entries()]
    .map(([category, groupedSources]) => ({
      category,
      label: researchCategoryLabel(category),
      sources: groupedSources,
    }))
    .sort((a, b) => {
      if (a.category === 'uncategorized') return 1
      if (b.category === 'uncategorized') return -1
      return a.label.localeCompare(b.label)
    })
}

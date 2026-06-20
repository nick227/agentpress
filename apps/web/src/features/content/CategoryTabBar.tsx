interface Props {
  categories: Array<{ id: string; label: string }>
  activeCategory: string | null
  onChange: (category: string | null) => void
}

export function CategoryTabBar({ categories, activeCategory, onChange }: Props) {
  return (
    <div className="px-5 py-3 border-b flex gap-1.5 shrink-0">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
          activeCategory === null
            ? 'bg-foreground text-background'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }`}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          onClick={() => onChange(cat.id)}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            activeCategory === cat.id
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          {cat.label}
        </button>
      ))}
    </div>
  )
}

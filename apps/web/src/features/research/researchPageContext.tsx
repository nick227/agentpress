import { createContext, useContext, type ReactNode } from 'react'

export type ResearchSelection = { type: 'info' } | { type: 'prompts' } | { type: 'item'; id: string }

interface ResearchPageContextValue {
  selection: ResearchSelection
  onSelect: (selection: ResearchSelection) => void
  page: number
  onPageChange: (page: number) => void
}

const ResearchPageContext = createContext<ResearchPageContextValue | null>(null)

export function ResearchPageProvider({
  selection,
  onSelect,
  page,
  onPageChange,
  children,
}: ResearchPageContextValue & { children: ReactNode }) {
  return (
    <ResearchPageContext.Provider value={{ selection, onSelect, page, onPageChange }}>
      {children}
    </ResearchPageContext.Provider>
  )
}

export function useResearchPage() {
  const value = useContext(ResearchPageContext)
  if (!value) throw new Error('useResearchPage must be used within ResearchPageProvider')
  return value
}

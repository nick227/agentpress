import { createContext, useContext, type ReactNode } from 'react'

export type Selection =
  | { type: 'setup' }
  | { type: 'variable'; id: string }
  | { type: 'agent'; id: string }
  | { type: 'run'; id: string }
  | { type: 'workflow-editor' }

interface PipelineSelectionContextValue {
  selection: Selection
  onSelect: (selection: Selection) => void
}

const PipelineSelectionContext = createContext<PipelineSelectionContextValue | null>(null)

export function PipelineSelectionProvider({
  selection,
  onSelect,
  children,
}: PipelineSelectionContextValue & { children: ReactNode }) {
  return (
    <PipelineSelectionContext.Provider value={{ selection, onSelect }}>
      {children}
    </PipelineSelectionContext.Provider>
  )
}

export function usePipelineSelection() {
  const value = useContext(PipelineSelectionContext)
  if (!value) throw new Error('usePipelineSelection must be used within PipelineSelectionProvider')
  return value
}

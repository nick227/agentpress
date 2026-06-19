import { useLayoutEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useOutletContext } from 'react-router-dom'
import type { ShellOutletContext } from './Shell'

export function SidebarPortal({ children }: { children: ReactNode }) {
  const { sidebarSlotRef } = useOutletContext<ShellOutletContext>()
  const [slot, setSlot] = useState<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    setSlot(sidebarSlotRef.current)
  })

  if (!slot) return null
  return createPortal(children, slot)
}

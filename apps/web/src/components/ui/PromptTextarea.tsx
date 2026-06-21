import { forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { renderPromptVariableHighlight } from '@/lib/promptVariableHighlight'

export type PromptTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

export const PromptTextarea = forwardRef<HTMLTextAreaElement, PromptTextareaProps>(
  ({ className, value = '', onScroll, ...props }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const backdropRef = useRef<HTMLDivElement>(null)

    useImperativeHandle(ref, () => textareaRef.current as HTMLTextAreaElement)

    const resizeToContent = useCallback(() => {
      const textarea = textareaRef.current
      if (!textarea) return

      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight}px`
    }, [])

    function syncScroll(source: HTMLTextAreaElement) {
      if (!backdropRef.current) return
      backdropRef.current.scrollTop = source.scrollTop
      backdropRef.current.scrollLeft = source.scrollLeft
    }

    const text = String(value)

    useLayoutEffect(() => {
      resizeToContent()
    }, [resizeToContent, text])

    useLayoutEffect(() => {
      const textarea = textareaRef.current
      if (!textarea || typeof ResizeObserver === 'undefined') return

      let width = textarea.clientWidth
      const observer = new ResizeObserver(() => {
        if (textarea.clientWidth === width) return
        width = textarea.clientWidth
        resizeToContent()
      })

      observer.observe(textarea)
      return () => observer.disconnect()
    }, [resizeToContent])

    return (
      <div className="relative rounded border border-input-border focus-within:ring-2 focus-within:ring-ring">
        <div
          ref={backdropRef}
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-0 overflow-auto px-3 py-2 text-sm whitespace-pre-wrap break-words',
            className,
          )}
        >
          <div className="text-foreground">
            {renderPromptVariableHighlight(text)}
            {text.endsWith('\n') ? '\n' : null}
          </div>
        </div>
        <textarea
          ref={textareaRef}
          value={value}
          onScroll={(event) => {
            syncScroll(event.currentTarget)
            onScroll?.(event)
          }}
          className={cn(
            'relative z-10 block w-full bg-transparent px-3 py-2 text-sm',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'text-transparent caret-foreground selection:bg-accent/20',
            className,
          )}
          {...props}
        />
      </div>
    )
  },
)

PromptTextarea.displayName = 'PromptTextarea'

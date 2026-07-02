// Searchable select dropdown — drop-in replacement for <Select> with a search bar.
// Visually matches SelectTrigger / SelectContent from select.tsx.
import { useState, useEffect, useRef } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { UnfoldMoreIcon, Tick02Icon, Search01Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

export interface SearchableOption {
  value: string
  label: string
}

interface SearchableSelectProps {
  value: string
  onValueChange: (value: string) => void
  options: SearchableOption[]
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  emptyMessage?: string
  className?: string
}

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  disabled,
  loading,
  emptyMessage = "No results found.",
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = search.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch("")
      }
    }
    document.addEventListener("mousedown", onMouseDown)
    return () => document.removeEventListener("mousedown", onMouseDown)
  }, [open])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0)
  }, [open])

  function toggle() {
    if (disabled || loading) return
    setOpen((v) => !v)
    if (open) setSearch("")
  }

  function pick(optValue: string) {
    onValueChange(optValue)
    setOpen(false)
    setSearch("")
  }

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Trigger — matches SelectTrigger exactly */}
      <button
        type="button"
        disabled={disabled || loading}
        onClick={toggle}
        className={cn(
          "flex h-7 w-full items-center justify-between gap-1.5 rounded-md border border-input bg-input/20",
          "px-2 py-1.5 text-xs/relaxed whitespace-nowrap transition-colors outline-none",
          "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "dark:bg-input/30 dark:hover:bg-input/50",
          !value && "text-muted-foreground",
          open && "border-ring ring-2 ring-ring/30"
        )}
      >
        <span className="truncate">
          {loading ? "Loading..." : (selected?.label ?? placeholder)}
        </span>
        <HugeiconsIcon
          icon={UnfoldMoreIcon}
          strokeWidth={2}
          className="pointer-events-none size-3.5 shrink-0 text-muted-foreground"
        />
      </button>

      {/* Dropdown panel — matches SelectContent */}
      {open && !loading && (
        <div className="absolute z-50 mt-1 w-full min-w-32 overflow-hidden rounded-lg border-0 bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10">
          {/* Search row */}
          <div className="flex items-center gap-1.5 border-b border-border/40 px-2 py-1.5">
            <HugeiconsIcon
              icon={Search01Icon}
              strokeWidth={2}
              className="size-3.5 shrink-0 text-muted-foreground"
            />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
              onKeyDown={(e) => {
                if (e.key === "Escape") { setOpen(false); setSearch("") }
                if (e.key === "Enter" && filtered.length === 1) pick(filtered[0].value)
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3" />
              </button>
            )}
          </div>

          {/* Option list — matches SelectItem */}
          <div className="max-h-56 overflow-y-auto p-1 scroll-my-1">
            {filtered.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                {emptyMessage}
              </p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => pick(o.value)}
                  className={cn(
                    "relative flex min-h-7 w-full cursor-default items-center gap-2 rounded-md px-2 py-1 text-xs/relaxed",
                    "outline-hidden select-none transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    o.value === value && "bg-accent/40"
                  )}
                >
                  <span className="pointer-events-none absolute end-2 flex items-center justify-center">
                    <HugeiconsIcon
                      icon={Tick02Icon}
                      strokeWidth={2}
                      className={cn(
                        "size-3.5 pointer-events-none",
                        o.value === value ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </span>
                  <span className="truncate">{o.label}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

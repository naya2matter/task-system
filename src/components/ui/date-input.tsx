import * as React from "react"
import { format, isValid, parse } from "date-fns"
import type { Matcher } from "react-day-picker"
import { Popover as PopoverPrimitive } from "radix-ui"
import { CalendarDays } from "lucide-react"

import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"

function parseDateValue(value?: string | number | readonly string[] | null) {
  if (typeof value !== "string" || value.length !== 10) return undefined

  const parsed = parse(value, "yyyy-MM-dd", new Date())
  return isValid(parsed) ? parsed : undefined
}

const DateInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  (
    {
      className,
      value,
      defaultValue,
      onChange,
      min,
      max,
      disabled,
      placeholder,
      type: _type,
      ...props
    },
    forwardedRef,
  ) => {
    const controlledValue = typeof value === "string" ? value : undefined
    const [internalValue, setInternalValue] = React.useState<string>(
      typeof defaultValue === "string" ? defaultValue : controlledValue ?? "",
    )
    const [open, setOpen] = React.useState(false)
    const innerRef = React.useRef<HTMLInputElement | null>(null)

    const rawValue = controlledValue ?? internalValue
    const selectedDate = parseDateValue(rawValue)
    const minDate = parseDateValue(min)
    const maxDate = parseDateValue(max)

    const disabledMatchers = React.useMemo<Matcher | Matcher[] | undefined>(() => {
      const matchers: Matcher[] = []
      if (minDate) matchers.push({ before: minDate })
      if (maxDate) matchers.push({ after: maxDate })
      return matchers.length > 0 ? matchers : undefined
    }, [maxDate, minDate])

    const mergedRef = React.useCallback(
      (el: HTMLInputElement | null) => {
        innerRef.current = el
        if (typeof forwardedRef === "function") {
          forwardedRef(el)
        } else if (forwardedRef) {
          forwardedRef.current = el
        }
      },
      [forwardedRef],
    )

    function emitChange(nextValue: string) {
      if (controlledValue === undefined) {
        setInternalValue(nextValue)
      }

      if (onChange) {
        const syntheticEvent = {
          target: { value: nextValue, name: props.name },
          currentTarget: { value: nextValue, name: props.name },
        } as React.ChangeEvent<HTMLInputElement>

        onChange(syntheticEvent)
      }
    }

    function handleSelect(date?: Date) {
      emitChange(date ? format(date, "yyyy-MM-dd") : "")
      setOpen(false)
      innerRef.current?.focus()
    }

    return (
      <PopoverPrimitive.Root modal={false} open={disabled ? false : open} onOpenChange={setOpen}>
        <PopoverPrimitive.Anchor asChild>
          <div className="relative">
            <input
              ref={mergedRef}
              readOnly
              disabled={disabled}
              value={selectedDate ? format(selectedDate, "MMM d, yyyy") : ""}
              placeholder={placeholder ?? "Pick a date"}
              onClick={() => {
                if (!disabled) setOpen(true)
              }}
              onKeyDown={(event) => {
                if (disabled) return

                if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
                  event.preventDefault()
                  setOpen(true)
                }
              }}
              className={cn(
                "h-10 w-full min-w-0 rounded-md border border-input bg-input/20 px-3 py-2 pr-10 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
                className,
              )}
              {...props}
            />

            <button
              type="button"
              aria-label="Open date picker"
              aria-expanded={open}
              disabled={disabled}
              onClick={() => setOpen((prev) => !prev)}
              className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-md bg-muted/30 p-1.5 transition-colors hover:bg-muted/50 disabled:cursor-not-allowed"
            >
              <CalendarDays className="size-4 text-muted-foreground" />
            </button>
          </div>
        </PopoverPrimitive.Anchor>

        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            side="bottom"
            align="start"
            sideOffset={8}
            collisionPadding={12}
            onOpenAutoFocus={(event: Event) => event.preventDefault()}
            className="z-50 w-auto max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-border/70 bg-popover/95 p-0 text-popover-foreground shadow-2xl ring-1 ring-foreground/10 outline-none backdrop-blur supports-backdrop-filter:bg-popover/90 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          >
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleSelect}
              disabled={disabledMatchers}
              captionLayout="dropdown"
            />
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    )
  },
)

DateInput.displayName = "DateInput"

export { DateInput }

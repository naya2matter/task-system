import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type TruncatedTextProps = {
  value: string
  className?: string
  maxWidth?: string
  tooltip?: boolean
}

export function TruncatedText({
  value,
  className,
  maxWidth,
  tooltip = true,
}: TruncatedTextProps) {
  const text = value?.trim() || "-"
  const textClassName = cn(
    "block min-w-0 overflow-hidden whitespace-nowrap text-ellipsis truncate",
    maxWidth,
    className
  )

  if (!tooltip) {
    return (
      <span className={textClassName} title={text}>
        {text}
      </span>
    )
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn(textClassName, "cursor-default")} title={text}>
            {text}
          </span>
        </TooltipTrigger>
        <TooltipContent
          sideOffset={8}
          className="max-w-xs wrap-break-word rounded-xl border border-white/10 bg-neutral-950/95 px-3 py-2 text-xs text-neutral-100 shadow-xl backdrop-blur-sm"
        >
          <p className="max-w-xs wrap-break-word">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

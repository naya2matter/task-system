// src/app/clocking/components/export-dialog.tsx
// Dialog that lets the user choose a date range before downloading clocking records as ZIP.
// Opened from the "Export Records" button on the records page.

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { DateInput } from "@/components/ui/date-input"
import { Download, Loader2, FileArchive } from "lucide-react"
import { toast } from "sonner"
import { isCancel } from "axios"
import { clockingService } from "@/services/clockingService"

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  // Date range state — both are optional (null exports all records)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [exporting, setExporting] = useState(false)

  // Reset form state when dialog closes
  function handleOpenChange(value: boolean) {
    if (!value) {
      setStartDate("")
      setEndDate("")
    }
    onOpenChange(value)
  }

  async function handleExport() {
    setExporting(true)
    try {
      // POST /clocking/export — triggers ZIP file download in the browser
      await clockingService.exportRecords({
        start_date: startDate || null,
        end_date: endDate || null,
      })
      // Close dialog on success; the browser handles the file download
      handleOpenChange(false)
    } catch (err) {
      // Ignore request cancellations; show a toast for real errors
      if (!isCancel(err)) {
        toast.error("Failed to export records. Please try again.")
      }
    } finally {
      setExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-130 p-6">
        <DialogHeader className="gap-3">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 w-fit">
            <FileArchive className="size-3 text-red-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">
              Export Records
            </span>
          </div>
          <DialogTitle className="text-3xl font-black tracking-tight">
            Export Clocking Records
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Optionally filter by date range. Leave both fields empty to export all records.
            The file will download as a ZIP archive.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-4">
          {/* Start date */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Start Date (optional)
            </label>
            <div className="rounded-2xl border border-border/20 bg-muted/40 transition-colors focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20">
              <DateInput
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border-none bg-transparent px-4 py-3 text-sm text-foreground outline-none"
              />
            </div>
          </div>

          {/* End date */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              End Date (optional)
            </label>
            <div className="rounded-2xl border border-border/20 bg-muted/40 transition-colors focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20">
              <DateInput
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border-none bg-transparent px-4 py-3 text-sm text-foreground outline-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-1 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={() => handleOpenChange(false)}
              disabled={exporting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="lg"
              className="flex-[1.5] gap-2 font-bold"
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Exporting…
                </>
              ) : (
                <>
                  <Download className="size-4" />
                  Download ZIP
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

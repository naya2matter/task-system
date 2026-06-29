// ─── Public Support Ticket Page ───────────────────────────────────────────────
// Route:  /support-ticket  (public — no auth required)
// Submits multipart/form-data to POST /tickets via the existing ticketsService.
// Guests must supply their name; authenticated users have identity auto-assigned.

import { useState, useRef, useEffect } from "react"
import { Link } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  FileText,
  Loader2,
  Upload,
  X,
} from "lucide-react"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { ticketsService } from "@/app/tickets/services/ticketsService"
import { usersService } from "@/services/usersService"
import type {
  ApiTicket,
  ApiTicketPriority,
  ApiTicketType,
  TicketFormValues,
} from "@/app/tickets/types"
import {
  TICKET_TYPE_LABELS,
  TICKET_PRIORITY_LABELS,
} from "@/app/tickets/types"
import taskSystemLogo from "@/assets/image.png"

// ─── Constants ────────────────────────────────────────────────────────────────
const ACCEPTED_TYPES = ".jpg,.jpeg,.png,.pdf,.doc,.docx,.csv,.mp4,.avi,.xlsx,.xls"
const MAX_FILE_MB = 5

// ─── Types ────────────────────────────────────────────────────────────────────
type ApiValidationErrors = Record<string, string[]>

// ─── Helper: extract field / global errors from an API error ──────────────────
function extractApiErrors(error: unknown): {
  message: string
  fields: ApiValidationErrors
} {
  const err = error as {
    response?: { data?: { message?: string; errors?: ApiValidationErrors } }
  }
  return {
    message:
      err?.response?.data?.message ?? "Something went wrong. Please try again.",
    fields: err?.response?.data?.errors ?? {},
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SupportTicketPage() {
  // Is a user already logged in?  (determines whether guest name field shows)
  const isLoggedIn = Boolean(localStorage.getItem("auth_token"))

  // ── Form state ───────────────────────────────────────────────────────────
  const [requesterName, setRequesterName] = useState("")
  const [title, setTitle]               = useState("")
  const [description, setDescription]   = useState("")
  const [type, setType]                 = useState<ApiTicketType>("quick_fix")
  const [priority, setPriority]         = useState<ApiTicketPriority>("medium")
  const [assignedTo, setAssignedTo]     = useState<string>("")
  const [files, setFiles]               = useState<File[]>([])
  const [isDragging, setIsDragging]     = useState(false)
  const [lightboxSrc, setLightboxSrc]   = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const filePreviewUrlsRef = useRef<Map<File, string>>(new Map())

  // ── Users list for the "Assign To" dropdown ──────────────────────────────
  const [users, setUsers]               = useState<{ id: number; name: string }[]>([])
  const [usersLoading, setUsersLoading] = useState(isLoggedIn)

  useEffect(() => {
    if (!isLoggedIn) {
      setUsersLoading(false)
      return
    }

    let cancelled = false
    usersService
      .getAll(1)
      .then(({ users: list }) => {
        if (!cancelled)
          setUsers(list.map((u) => ({ id: parseInt(u.id, 10), name: u.name })))
      })
      .catch(() => { /* non-critical — dropdown stays empty */ })
      .finally(() => { if (!cancelled) setUsersLoading(false) })
    return () => { cancelled = true }
  }, [isLoggedIn])

  useEffect(() => {
    return () => {
      filePreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      filePreviewUrlsRef.current.clear()
    }
  }, [])

  // ── Submission state ─────────────────────────────────────────────────────
  const [submitting, setSubmitting]       = useState(false)
  const [successTicket, setSuccessTicket] = useState<ApiTicket | null>(null)
  const [errorMsg, setErrorMsg]           = useState<string | null>(null)
  const [fieldErrors, setFieldErrors]     = useState<ApiValidationErrors>({})

  // ── Local validation (runs before the API call) ──────────────────────────
  function validate(): boolean {
    const errs: ApiValidationErrors = {}
    if (!isLoggedIn && !requesterName.trim())
      errs.requester_name = ["Your name is required when submitting as a guest."]
    if (!title.trim())       errs.title       = ["Subject is required."]
    if (!description.trim()) errs.description = ["Description is required."]
    for (const f of files) {
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        errs["attachments.0"] = [
          `"${f.name}" exceeds the ${MAX_FILE_MB} MB limit.`,
        ]
        break
      }
    }
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── File helpers ─────────────────────────────────────────────────────────
  function addFiles(incoming: File[]) {
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name))
      return [...prev, ...incoming.filter((f) => !existing.has(f.name))]
    })
  }

  function removeFile(index: number) {
    setFiles((prev) => {
      const target = prev[index]
      if (target) {
        const previewUrl = filePreviewUrlsRef.current.get(target)
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl)
          filePreviewUrlsRef.current.delete(target)
        }
      }
      return prev.filter((_, i) => i !== index)
    })
  }

  function isImageFile(file: File): boolean {
    return file.type.startsWith("image/")
  }

  function getPreviewUrl(file: File): string {
    const existing = filePreviewUrlsRef.current.get(file)
    if (existing) return existing
    const created = URL.createObjectURL(file)
    filePreviewUrlsRef.current.set(file, created)
    return created
  }

  // Allow pasting screenshots/images directly with Ctrl+V anywhere on the page.
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const items = Array.from(event.clipboardData?.items ?? [])
      const pastedImages = items
        .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null)
        .map((file) => {
          const extension = file.type.split("/")[1] ?? "png"
          return new File([file], `pasted-${Date.now()}.${extension}`, {
            type: file.type,
          })
        })

      if (pastedImages.length > 0) {
        addFiles(pastedImages)
      }
    }

    document.addEventListener("paste", onPaste)
    return () => document.removeEventListener("paste", onPaste)
  }, [])

  // ── Form submit ──────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setFieldErrors({})
    if (!validate()) return

    const values: TicketFormValues = {
      title:          title.trim(),
      description:    description.trim(),
      type,
      priority,
      assigned_to:
        assignedTo === "" ? undefined
        : assignedTo === "none" ? null
        : parseInt(assignedTo, 10),
      newAttachments: files,
      ...(!isLoggedIn && requesterName.trim()
        ? { requester_name: requesterName.trim() }
        : {}),
    }

    setSubmitting(true)
    try {
      const ticket = await ticketsService.create(values)
      setSuccessTicket(ticket)
    } catch (err) {
      const { message, fields } = extractApiErrors(err)
      setErrorMsg(message)
      setFieldErrors(fields)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Reset form for "Submit another ticket" ───────────────────────────────
  function resetForm() {
    setSuccessTicket(null)
    setRequesterName("")
    setTitle("")
    setDescription("")
    setType("quick_fix")
    setPriority("medium")
    setAssignedTo("")
    filePreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    filePreviewUrlsRef.current.clear()
    setFiles([])
    setErrorMsg(null)
    setFieldErrors({})
  }

  // ── First error for a field key ──────────────────────────────────────────
  const fe = (key: string) => fieldErrors[key]?.[0]

  // ─────────────────────────────────────────────────────────────────────────
  // Success state
  // ─────────────────────────────────────────────────────────────────────────
  if (successTicket) {
    return (
      <div className="relative min-h-svh bg-background flex items-center justify-center p-4">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.35_0.15_25)_0%,transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,oklch(0.25_0.10_20)_0%,transparent_50%)]" />

        <Card className="relative z-10 w-full max-w-md text-center shadow-xl">
          <CardContent className="flex flex-col items-center gap-5 p-10">
            <div className="rounded-full bg-green-500/10 p-4 ring-1 ring-green-500/20">
              <CheckCircle2 className="size-10 text-green-500" />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight">
                Ticket Submitted!
              </h2>
              <p className="text-sm text-muted-foreground">
                Your request has been received. Our team will review it and get
                back to you as soon as possible.
              </p>
            </div>

            <div className="w-full rounded-lg border bg-muted/30 px-4 py-3 text-left space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Ticket details
              </p>
              <p className="text-sm font-medium">{successTicket.title}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  #{successTicket.id}
                </Badge>
                <Badge variant="secondary" className="text-xs capitalize">
                  {TICKET_TYPE_LABELS[successTicket.type]}
                </Badge>
                <Badge variant="secondary" className="text-xs capitalize">
                  {TICKET_PRIORITY_LABELS[successTicket.priority]}
                </Badge>
              </div>
            </div>

            <div className="flex gap-3 w-full">
              <Button variant="outline" className="flex-1" onClick={resetForm}>
                Submit another
              </Button>
              {isLoggedIn && (
                <Button asChild className="flex-1">
                  <Link to="/tickets">View tickets</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Form state
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-svh bg-background">
      {/* Decorative background gradients (matches auth pages) */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.35_0.15_25)_0%,transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,oklch(0.25_0.10_20)_0%,transparent_50%)]" />

      <div className="relative z-10 flex min-h-svh flex-col items-center justify-start px-4 py-8">

        {/* ── Page header ────────────────────────────────────────────────── */}
        <header className="mb-6 text-center max-w-2xl flex flex-col items-center">
          {/* <div className="mx-auto mb-6 flex items-center justify-center w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 shadow-lg overflow-hidden p-1"> */}
            <img src={taskSystemLogo} alt="Task System Logo" className="w-24 h-24 object-contain drop-shadow-sm" />
          {/* </div> */}
          <Badge
            variant="outline"
            className="mb-3 text-xs uppercase tracking-widest"
          >
            Support Portal
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Submit a Support Ticket
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Describe your issue and our team will respond as soon as possible.
          </p>
        </header>

        {/* ── Form card ──────────────────────────────────────────────────── */}
        <Card className="w-full max-w-4xl shadow-xl">
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-lg">New Ticket</CardTitle>
            <CardDescription>
              Fields marked <span className="text-foreground">*</span> are
              required.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* ── Requester name — guests only ─────────────────────────── */}
                {!isLoggedIn && (
                  <div className="space-y-1.5">
                    <Label htmlFor="requesterName">Your Name *</Label>
                    <Input
                      id="requesterName"
                      value={requesterName}
                      onChange={(e) => setRequesterName(e.target.value)}
                      placeholder="Enter your full name"
                      maxLength={255}
                      aria-describedby={
                        fe("requester_name") ? "err-name" : undefined
                      }
                      className={
                        fe("requester_name") ? "border-destructive" : ""
                      }
                    />
                    {fe("requester_name") && (
                      <p id="err-name" className="text-xs text-destructive">
                        {fe("requester_name")}
                      </p>
                    )}
                  </div>
                )}

                {/* ── Subject ─────────────────────────────────────────────── */}
                <div className={`space-y-1.5 ${isLoggedIn ? 'md:col-span-2' : ''}`}>
                  <Label htmlFor="title">Subject *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Brief summary of your issue or request"
                    maxLength={255}
                    aria-describedby={fe("title") ? "err-title" : undefined}
                    className={fe("title") ? "border-destructive" : ""}
                  />
                  {fe("title") && (
                    <p id="err-title" className="text-xs text-destructive">
                      {fe("title")}
                    </p>
                  )}
                </div>
              </div>

              {/* ── Description ─────────────────────────────────────────── */}
              <div className="space-y-1.5">
                <Label htmlFor="description">Description *</Label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your issue in detail — include steps to reproduce, what you expected, and what actually happened."
                    rows={4}
                  aria-describedby={
                    fe("description") ? "err-desc" : undefined
                  }
                  className={`flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 resize-none ${
                    fe("description") ? "border-destructive" : "border-input"
                  }`}
                />
                {fe("description") && (
                  <p id="err-desc" className="text-xs text-destructive">
                    {fe("description")}
                  </p>
                )}
              </div>

              {/* ── Category + Priority + AssignTo ──────────────────────── */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="type">Category *</Label>
                  <Select
                    value={type}
                    onValueChange={(v) => setType(v as ApiTicketType)}
                  >
                    <SelectTrigger
                      id="type"
                      className={fe("type") ? "border-destructive" : ""}
                      aria-describedby={fe("type") ? "err-type" : undefined}
                    >
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        Object.entries(TICKET_TYPE_LABELS) as [
                          ApiTicketType,
                          string,
                        ][]
                      ).map(([val, label]) => (
                        <SelectItem key={val} value={val}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fe("type") && (
                    <p id="err-type" className="text-xs text-destructive">
                      {fe("type")}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="priority">Priority *</Label>
                  <Select
                    value={priority}
                    onValueChange={(v) => setPriority(v as ApiTicketPriority)}
                  >
                    <SelectTrigger
                      id="priority"
                      className={fe("priority") ? "border-destructive" : ""}
                      aria-describedby={
                        fe("priority") ? "err-priority" : undefined
                      }
                    >
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        Object.entries(TICKET_PRIORITY_LABELS) as [
                          ApiTicketPriority,
                          string,
                        ][]
                      ).map(([val, label]) => (
                        <SelectItem key={val} value={val}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fe("priority") && (
                    <p id="err-priority" className="text-xs text-destructive">
                      {fe("priority")}
                    </p>
                  )}
                </div>

                {/* ── Assign To ───────────────────────────────────────────── */}
                {isLoggedIn && (
                  <div className="space-y-1.5">
                    <Label htmlFor="assignedTo">Assign To</Label>
                    <SearchableSelect
                      value={assignedTo || "none"}
                      onValueChange={(v) => setAssignedTo(v === "none" ? "" : v)}
                      options={[
                        { value: "none", label: "Unassigned" },
                        ...users.map((u) => ({ value: String(u.id), label: u.name })),
                      ]}
                      placeholder="Unassigned"
                      loading={usersLoading}
                      emptyMessage="No users found."
                    />
                  </div>
                )}
              </div>

              {/* ── Attachments ─────────────────────────────────────────── */}
              <div className="space-y-3">
                <Label>Attachments</Label>

                {/* Drop zone */}
                <div
                  role="region"
                  aria-label="File drop zone"
                  onDrop={(e) => {
                    e.preventDefault()
                    setIsDragging(false)
                    addFiles(Array.from(e.dataTransfer.files))
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setIsDragging(true)
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node))
                      setIsDragging(false)
                  }}
                  className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/20"
                  }`}
                >
                  <Upload className="size-6 text-muted-foreground" />
                  <p className="text-sm">
                    Drop files here or{" "}
                    <button
                      type="button"
                      className="text-primary underline-offset-2 hover:underline"
                      onClick={() => fileRef.current?.click()}
                    >
                      browse
                    </button>
                  </p>
                  <span className="text-xs text-muted-foreground">
                    jpg, png, pdf, doc, docx, csv, mp4 — max {MAX_FILE_MB} MB
                    each
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Tip: press Ctrl+V to paste a copied screenshot directly.
                  </span>
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    accept={ACCEPTED_TYPES}
                    className="hidden"
                    onChange={(e) => {
                      addFiles(Array.from(e.target.files ?? []))
                      if (fileRef.current) fileRef.current.value = ""
                    }}
                  />
                </div>

                {/* File list */}
                {files.length > 0 && (
                  <ul className="space-y-2" aria-label="Selected files">
                    {files.map((f, i) => (
                      <li
                        key={`${f.name}-${i}`}
                        className="flex items-center gap-3 rounded-md border bg-muted/20 px-3 py-2 text-sm"
                      >
                        {isImageFile(f) ? (
                          <button
                            type="button"
                            onClick={() => setLightboxSrc(getPreviewUrl(f))}
                            className="relative shrink-0"
                            aria-label={`Preview ${f.name}`}
                          >
                            <img
                              src={getPreviewUrl(f)}
                              alt={f.name}
                              className="size-10 rounded object-cover border"
                            />
                            <span className="absolute inset-0 flex items-center justify-center rounded bg-black/35 opacity-0 transition-opacity hover:opacity-100">
                              <Eye className="size-3.5 text-white" />
                            </span>
                          </button>
                        ) : (
                          <FileText className="size-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="flex-1 truncate">{f.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {(f.size / 1024).toFixed(0)} KB
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove ${f.name}`}
                          onClick={() => removeFile(i)}
                          className="text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <X className="size-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {fe("attachments.0") && (
                  <p className="text-xs text-destructive">
                    {fe("attachments.0")}
                  </p>
                )}
              </div>

              {/* ── Global API error ─────────────────────────────────────── */}
              {errorMsg && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* ── Actions ──────────────────────────────────────────────── */}
              <div className="flex items-center gap-3 pt-1">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="min-w-35"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    "Submit Ticket"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* ── Footer link ────────────────────────────────────────────────── */}
        <p className="mt-6 text-xs text-muted-foreground">
          {isLoggedIn ? (
            <>
              Back to the app?{" "}
              <Link to="/" className="text-primary hover:underline">
                Go to dashboard
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link to="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </>
          )}
        </p>

        <Dialog
          open={Boolean(lightboxSrc)}
          onOpenChange={(open) => { if (!open) setLightboxSrc(null) }}
        >
          <DialogContent>
            {lightboxSrc && (
              <div className="flex items-center justify-center">
                <img
                  src={lightboxSrc}
                  alt="Attachment preview"
                  className="max-w-full max-h-[80vh] object-contain"
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

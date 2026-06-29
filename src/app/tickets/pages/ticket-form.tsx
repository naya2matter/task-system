// â”€â”€â”€ Ticket Form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// â”€â”€â”€ Ticket Form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
"use client"
// Reusable form for creating and editing tickets.
// Create mode: POST /tickets (multipart/form-data, public endpoint)
// Edit mode:   POST /tickets/{id} (multipart/form-data, auth required)
//
// Key differences from mock version:
//  - Uses real API types (ApiTicketType, ApiTicketPriority, ApiTicketStatus)
//  - Loads real users from GET /users for the "Assign To" dropdown
//  - Supports file attachments (up to 5 MB each)
//  - In edit mode: shows existing attachments with individual remove buttons
//  - Shows requester_name field for guest tickets (no requester relation)
//  - Displays API errors inline below the submit button
//  - Submit/cancel callbacks now receive TicketFormValues (API-aligned)

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertCircle, ArrowLeft, Clipboard, Eye, FileText, Upload, X } from "lucide-react"
import { SearchableSelect } from "@/components/ui/searchable-select"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
// API-aligned types from the tickets module
import type {
  ApiTicket,
  ApiTicketType,
  ApiTicketPriority,
  ApiTicketStatus,
  TicketFormValues,
} from "@/app/tickets/types"
import {
  TICKET_TYPE_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
} from "@/app/tickets/types"
// Users service â€” used to populate the "Assign To" dropdown
import { usersService } from "@/services/usersService"

// â”€â”€ Static option arrays (enum values + labels) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const typeOptions: { value: ApiTicketType; label: string }[] = [
  { value: "quick_fix",         label: TICKET_TYPE_LABELS.quick_fix },
  { value: "bug_investigation", label: TICKET_TYPE_LABELS.bug_investigation },
  { value: "user_support",      label: TICKET_TYPE_LABELS.user_support },
  { value: "suggestion",        label: TICKET_TYPE_LABELS.suggestion },
]

const priorityOptions: { value: ApiTicketPriority; label: string }[] = [
  { value: "low",      label: TICKET_PRIORITY_LABELS.low },
  { value: "medium",   label: TICKET_PRIORITY_LABELS.medium },
  { value: "high",     label: TICKET_PRIORITY_LABELS.high },
  { value: "critical", label: TICKET_PRIORITY_LABELS.critical },
]

// Status options â€” only shown in edit mode (create always starts as "open")
const statusOptions: { value: ApiTicketStatus; label: string }[] = [
  { value: "open",        label: TICKET_STATUS_LABELS.open },
  { value: "in_progress", label: TICKET_STATUS_LABELS.in_progress },
  { value: "resolved",    label: TICKET_STATUS_LABELS.resolved },
]

// Allowed MIME types / extensions for file attachments
const ACCEPTED_FILE_TYPES =
  ".jpg,.jpeg,.png,.pdf,.doc,.docx,.csv,.mp4,.avi,.xlsx,.xls"
const MAX_FILE_SIZE_MB = 5

// Base URL for serving stored files (strips /api suffix from the API base)
const STORAGE_BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:8000/api").replace(/\/api\/?$/, "")

type TicketFormProps = {
  mode: "create" | "edit"
  // The full ApiTicket to prefill when editing (null for create)
  initialData?: ApiTicket | null
  // Called with the collected form values; parent decides which store action to call
  onSubmit: (values: TicketFormValues) => void
  onCancel: () => void
  // Controls the submit button disabled state and spinner
  submitting?: boolean
  // Inline API error displayed below the form actions
  submitError?: string | null
}

export function TicketForm({
  mode,
  initialData,
  onSubmit,
  onCancel,
  submitting = false,
  submitError,
}: TicketFormProps) {
  // â”€â”€ Core field state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [title,       setTitle]       = useState(initialData?.title ?? "")
  const [description, setDescription] = useState(initialData?.description ?? "")
  const [type,        setType]        = useState<ApiTicketType>(
    initialData?.type ?? "quick_fix",
  )
  const [priority, setPriority] = useState<ApiTicketPriority>(
    initialData?.priority ?? "medium",
  )
  // Status is only editable in edit mode
  const [status, setStatus] = useState<ApiTicketStatus>(
    initialData?.status ?? "open",
  )

  // â”€â”€ Assignment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Store as string for the Select component; convert to number on submit
  const [assignedTo, setAssignedTo] = useState<string>(
    initialData?.assigned_to != null ? String(initialData.assigned_to) : "",
  )

  // â”€â”€ Requester name (guest tickets only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Shown when: creating without an auth token, or editing a ticket that has no
  // linked User (requester relation is null = was submitted as a guest).
  const isAuthenticated = Boolean(localStorage.getItem("auth_token"))
  const isGuestTicket   = mode === "edit" && !initialData?.requester
  const showRequesterName = !isAuthenticated || isGuestTicket
  const [requesterName, setRequesterName] = useState(
    initialData?.requester_name ?? "",
  )

  // â”€â”€ File attachments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // newFileEntries: files chosen by the user, each with an optional image preview URL
  type FileEntry = { file: File; previewUrl: string | null }
  const [newFileEntries, setNewFileEntries] = useState<FileEntry[]>([])
  // keepIds: IDs of existing attachments to keep (edit mode); starts with all present
  const [keepIds, setKeepIds] = useState<number[]>(
    initialData?.attachments?.map((a) => a.id) ?? [],
  )
  // Lightbox: URL of the image currently being previewed full-size
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  // Drag-over state for the drop zone
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Track all created object URLs so they can be revoked on unmount
  const createdUrlsRef = useRef<string[]>([])

  // Revoke all object URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      createdUrlsRef.current.forEach(URL.revokeObjectURL)
    }
  }, [])

  // Global paste handler — captures images pasted anywhere on the page
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = Array.from(e.clipboardData?.items ?? [])
      const imageFiles = items
        .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
        .map((item) => {
          const f = item.getAsFile()
          if (!f) return null
          // Give pasted images a unique timestamped name
          const ext = f.type.split("/")[1] ?? "png"
          return new File([f], `pasted-${Date.now()}.${ext}`, { type: f.type })
        })
        .filter((f): f is File => f !== null)
      if (imageFiles.length > 0) addFiles(imageFiles)
    }
    document.addEventListener("paste", onPaste)
    return () => document.removeEventListener("paste", onPaste)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // â”€â”€ Users list for the "Assign To" dropdown â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Fetched once on mount; only a minimal shape is needed (id + name)
  const [users,        setUsers]        = useState<{ id: number; name: string }[]>([])
  const [usersLoading, setUsersLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setUsersLoading(true)
    usersService
      .getAll(1)
      .then(({ users: list }) => {
        if (!cancelled) {
          // usersService returns UI User with string id; parse back to number for the API
          setUsers(list.map((u) => ({ id: parseInt(u.id, 10), name: u.name })))
        }
      })
      .catch(() => {
        // Users fetch failure is non-critical â€” dropdown just stays empty
      })
      .finally(() => { if (!cancelled) setUsersLoading(false) })
    return () => { cancelled = true }
  }, [])

  // â”€â”€ Validation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!title.trim())       next.title       = "Title is required"
    if (!description.trim()) next.description = "Description is required"
    // Guest must supply their name when not authenticated
    if (showRequesterName && !isAuthenticated && !requesterName.trim()) {
      next.requesterName = "Your name is required when submitting as a guest"
    }
    // Check file sizes
    for (const { file } of newFileEntries) {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        next.files = `"${file.name}" exceeds the ${MAX_FILE_SIZE_MB} MB limit`
        break
      }
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  // â”€â”€ File picker handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // ── File picker / drag / paste helpers ──────────────────────────────────────
  // Central function to add files from any source (picker, drop, paste)
  function addFiles(files: File[]) {
    const entries = files.map((file) => {
      if (file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file)
        createdUrlsRef.current.push(url)
        return { file, previewUrl: url }
      }
      return { file, previewUrl: null }
    })
    setNewFileEntries((prev) => {
      const existingNames = new Set(prev.map((e) => e.file.name))
      return [...prev, ...entries.filter((e) => !existingNames.has(e.file.name))]
    })
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(e.target.files ?? []))
    // Reset input so the same file can be re-added after removal
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function removeNewFile(index: number) {
    setNewFileEntries((prev) => prev.filter((_, i) => i !== index))
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    // Only clear when leaving the zone entirely (not a child element)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false)
    }
  }

  // Remove an existing attachment from the "keep" list (edit mode)
  function removeExistingAttachment(id: number) {
    setKeepIds((prev) => prev.filter((k) => k !== id))
  }

  // â”€â”€ Submit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    const values: TicketFormValues = {
      title:             title.trim(),
      description:       description.trim(),
      type,
      priority,
      // Status only sent in edit mode
      ...(mode === "edit" ? { status } : {}),
      // Map "" â†’ undefined (no assignment change), "none" â†’ null (clear assignee)
      assigned_to:
        assignedTo === ""     ? undefined
        : assignedTo === "none" ? null
        : parseInt(assignedTo, 10),
      // Only include requester_name when the field is visible
      ...(showRequesterName && requesterName.trim()
        ? { requester_name: requesterName.trim() }
        : {}),
      newAttachments:    newFileEntries.map((e) => e.file),
      // Only relevant in edit mode â€” tells the backend which files to keep
      keepAttachmentIds: mode === "edit" ? keepIds : undefined,
    }
    onSubmit(values)
  }

  return (
    <div className="flex w-full justify-center p-4 md:p-8">
      <Card className="w-full max-w-4xl">
        <CardContent className="p-6 md:p-8">

          {/* â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon" onClick={onCancel} disabled={submitting}>
              <ArrowLeft />
            </Button>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
                  {mode === "create" ? "Create Ticket" : "Edit Ticket"}
                </h2>
                <Badge variant="secondary" className="uppercase tracking-wider">
                  {mode}
                </Badge>
              </div>
              <p className="text-sm md:text-lg text-muted-foreground max-w-2xl">
                {mode === "create"
                  ? "Submit a new ticket to track an issue, feature, or request."
                  : "Update the details for this ticket."}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">

            {/* â”€â”€ Ticket Details â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <section className="space-y-4">
              <h3 className="text-lg font-semibold uppercase tracking-widest text-muted-foreground">
                Ticket Details
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Title â€” full width */}
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Brief summary of the issue or request..."
                    className="h-12"
                    maxLength={255}
                  />
                  {errors.title && (
                    <p className="text-sm text-destructive">{errors.title}</p>
                  )}
                </div>

                {/* Description â€” full width */}
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide full details about the ticket..."
                    rows={5}
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                  />
                  {errors.description && (
                    <p className="text-sm text-destructive">{errors.description}</p>
                  )}
                </div>

                {/* Type */}
                <div className="space-y-2">
                  <Label>Type *</Label>
                  <Select value={type} onValueChange={(v) => setType(v as ApiTicketType)}>
                    <SelectTrigger className="w-full h-12">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {typeOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Priority */}
                <div className="space-y-2">
                  <Label>Priority *</Label>
                  <Select
                    value={priority}
                    onValueChange={(v) => setPriority(v as ApiTicketPriority)}
                  >
                    <SelectTrigger className="w-full h-12">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {priorityOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status â€” edit mode only; create always begins as "open" */}
                {mode === "edit" && (
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={status}
                      onValueChange={(v) => setStatus(v as ApiTicketStatus)}
                    >
                      <SelectTrigger className="w-full h-12">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </section>

            {/* â”€â”€ People â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <section className="space-y-4">
              <h3 className="text-lg font-semibold uppercase tracking-widest text-muted-foreground">
                People
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Requester name â€” shown for guest submissions */}
                {showRequesterName && (
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="requesterName">
                      Your Name
                      {/* Required only when not authenticated */}
                      {!isAuthenticated && " *"}
                    </Label>
                    <Input
                      id="requesterName"
                      value={requesterName}
                      onChange={(e) => setRequesterName(e.target.value)}
                      placeholder="Enter your full name..."
                      className="h-12"
                      maxLength={255}
                    />
                    {errors.requesterName && (
                      <p className="text-sm text-destructive">{errors.requesterName}</p>
                    )}
                  </div>
                )}

                {/* Assign To â€” user dropdown loaded from GET /users */}
                <div className="space-y-2">
                  <Label>Assign To</Label>
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
              </div>
            </section>

            {/* â”€â”€ Attachments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <section className="space-y-4">
              <h3 className="text-lg font-semibold uppercase tracking-widest text-muted-foreground">
                Attachments
              </h3>

              {/* Existing attachments in edit mode â€” each has a remove button */}
              {/* Existing attachments in edit mode */}
              {mode === "edit" && initialData?.attachments && initialData.attachments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Existing attachments — click <X className="inline size-3" /> to mark for removal on save:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {initialData.attachments.map((att) => {
                      const kept = keepIds.includes(att.id)
                      const isImage = att.file_type.startsWith("image/")
                      const storageUrl = `${STORAGE_BASE}/storage/${att.file_path}`
                      return (
                        <div
                          key={att.id}
                          className={`relative rounded-lg border overflow-hidden transition-opacity ${
                            kept ? "" : "opacity-40"
                          }`}
                        >
                          {isImage ? (
                            <button
                              type="button"
                              title="Click to preview"
                              className="block w-full relative"
                              onClick={() => setLightboxSrc(storageUrl)}
                            >
                              <img
                                src={storageUrl}
                                alt={att.file_name}
                                className="w-full h-24 object-cover bg-muted"
                              />
                              <span className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/40">
                                <Eye className="size-5 text-white" />
                              </span>
                            </button>
                          ) : (
                            <div className="flex flex-col items-center justify-center h-24 bg-muted/40 gap-1">
                              <FileText className="size-8 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground uppercase tracking-wide">
                                {att.file_name.split(".").pop()}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-1 px-2 py-1.5 bg-background">
                            <span className="text-xs truncate text-muted-foreground min-w-0">
                              {att.file_name}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-5 shrink-0"
                              title={kept ? "Mark for removal" : "Restore"}
                              onClick={() =>
                                kept
                                  ? removeExistingAttachment(att.id)
                                  : setKeepIds((p) => [...p, att.id])
                              }
                            >
                              <X className="size-3" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Drop zone + file browser */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-default ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/30"
                }`}
              >
                <Upload className="size-8 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    Drop files here or{" "}
                    <button
                      type="button"
                      className="text-primary underline-offset-2 hover:underline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      browse
                    </button>
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Clipboard className="size-3" />
                    You can also paste images with Ctrl+V
                  </p>
                  <span className="text-xs text-muted-foreground">
                    jpg, jpeg, png, pdf, doc, docx, csv, mp4, avi, xlsx, xls â€” max {MAX_FILE_SIZE_MB} MB each
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ACCEPTED_FILE_TYPES}
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* New files grid */}
              {newFileEntries.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {newFileEntries.map(({ file, previewUrl }, i) => (
                    <div
                      key={file.name}
                      className="relative rounded-lg border overflow-hidden"
                    >
                      {previewUrl ? (
                        <button
                          type="button"
                          title="Click to preview"
                          className="block w-full relative"
                          onClick={() => setLightboxSrc(previewUrl)}
                        >
                          <img
                            src={previewUrl}
                            alt={file.name}
                            className="w-full h-24 object-cover bg-muted"
                          />
                          <span className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/40">
                            <Eye className="size-5 text-white" />
                          </span>
                        </button>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-24 bg-muted/40 gap-1">
                          <FileText className="size-8 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground uppercase tracking-wide">
                            {file.name.split(".").pop()}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-1 px-2 py-1.5 bg-background">
                        <div className="min-w-0">
                          <p className="text-xs truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-5 shrink-0"
                          onClick={() => removeNewFile(i)}
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {errors.files && (
                <p className="text-sm text-destructive">{errors.files}</p>
              )}
            </section>

            {/* â”€â”€ API error banner (non-cancel errors from the store) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {submitError && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* â”€â”€ Form actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div className="flex gap-3 pt-2">
              <Button type="submit" size="lg" disabled={submitting}>
                {submitting
                  ? "Saving..."
                  : mode === "create"
                    ? "Create Ticket"
                    : "Save Changes"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={onCancel}
                disabled={submitting}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>

        {/* Lightbox dialog for image previews */}
        <Dialog open={Boolean(lightboxSrc)} onOpenChange={(open) => { if (!open) setLightboxSrc(null) }}>
          <DialogContent>
            {lightboxSrc && (
              <div className="flex items-center justify-center">
                <img src={lightboxSrc} alt="Attachment preview" className="max-w-full max-h-[80vh] object-contain" />
              </div>
            )}
          </DialogContent>
        </Dialog>

      </Card>
    </div>
  )
}


// src/app/account/page.tsx
// ─── Account Page ────────────────────────────────────────────────
// Three sections controlled by a sidebar tab nav:
//   • Profile  — GET /me on mount, POST /profile to save changes
//   • Password — POST /profile/password to change password
//
// Error handling follows the project-wide pattern:
//   - isCancel errors are silently ignored
//   - 422 Validation errors surface per-field messages
//   - Other errors show a general banner

import { useState, useEffect, useRef } from "react"
import { isCancel, isAxiosError } from "axios"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, Camera, Loader2, Lock, RefreshCw, User, Eye, EyeOff } from "lucide-react"
import { authService } from "@/services/authService"
import type { User as UserType } from "@/types"
import type { ApiValidationError } from "@/types"

// ─── Helper: derive 2-char initials from a full name ────────────
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ─── Helper: extract field-level errors from a 422 response ─────
function extractFieldErrors(error: unknown): Record<string, string> {
  if (isAxiosError<ApiValidationError>(error) && error.response?.data?.errors) {
    const raw = error.response.data.errors
    // Flatten arrays — take the first message per field
    return Object.fromEntries(
      Object.entries(raw).map(([field, msgs]) => [field, msgs[0]])
    )
  }
  return {}
}

// ─── Helper: extract a general error message ─────────────────────
function extractGeneralError(error: unknown): string {
  if (isAxiosError<ApiValidationError>(error)) {
    return error.response?.data?.message ?? "An error occurred. Please try again."
  }
  return "An unexpected error occurred. Please try again."
}

// ─────────────────────────────────────────────────────────────────
// ProfileTab
// Displays user info loaded from GET /me and lets the user update
// name, email and avatar via POST /profile (multipart/form-data).
// ─────────────────────────────────────────────────────────────────
interface ProfileTabProps {
  /** User data fetched from GET /me — null while loading */
  user: UserType | null
  /** True while the initial GET /me fetch is in-flight */
  loadingUser: boolean
  /** Called after a successful POST /profile so the parent can refresh state */
  onProfileSaved: (updated: UserType) => void
}

function ProfileTab({ user, loadingUser, onProfileSaved }: ProfileTabProps) {
  // ── Form state ───────────────────────────────────────────────
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")

  // ── Avatar state ─────────────────────────────────────────────
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  // Keep a ref to the last object-URL so we can revoke it when a new one is set
  const prevObjectUrl = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // ── Submission state ─────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Populate form fields once the user object arrives from GET /me
  useEffect(() => {
    if (user) {
      setName(user.name)
      setEmail(user.email)
      // Use the full avatar URL returned by the server
      setAvatarPreview(user.avatar_url)
    }
  }, [user])

  // Revoke any object-URL we created for local previews when the tab unmounts
  useEffect(() => {
    return () => {
      if (prevObjectUrl.current) URL.revokeObjectURL(prevObjectUrl.current)
    }
  }, [])

  // ── Avatar helpers ───────────────────────────────────────────

  function handleAvatarClick() {
    fileInputRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    if (!file) return
    setAvatarFile(file)
    // Revoke previous preview object-URL to avoid memory leaks
    if (prevObjectUrl.current) URL.revokeObjectURL(prevObjectUrl.current)
    const url = URL.createObjectURL(file)
    prevObjectUrl.current = url
    setAvatarPreview(url)
  }

  // ── Client-side validation ───────────────────────────────────
  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = "Name is required."
    if (!email.trim()) next.email = "Email is required."
    else if (!/\S+@\S+\.\S+/.test(email)) next.email = "Enter a valid email address."
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  // ── Submit handler — calls POST /profile ─────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    if (!validate()) return

    setSubmitting(true)
    try {
      const updated = await authService.updateProfile({
        name: name.trim(),
        email: email.trim(),
        // Only include a file when the user actually selected one
        avatar: avatarFile ?? undefined,
      })
      // Clear the file picker after a successful upload
      setAvatarFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
      // Bubble the fresh user data up so the page header can re-render
      onProfileSaved(updated)
    } catch (error) {
      // Silently ignore request-cancel errors (unmount / HMR)
      if (isCancel(error)) return
      // Surface per-field errors from a 422 response
      setFieldErrors(extractFieldErrors(error))
      setSubmitError(extractGeneralError(error))
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading skeleton — shown while GET /me is in-flight ──────
  if (loadingUser) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Skeleton className="size-20 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
        <Skeleton className="h-px w-full" />
        <Skeleton className="h-10 rounded-md" />
        <Skeleton className="h-10 rounded-md" />
        <Skeleton className="h-10 w-32 self-end rounded-md" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Section header */}
      <div>
        <CardTitle className="text-lg">Profile Information</CardTitle>
        <CardDescription className="mt-1">
          Update your personal details and profile picture.
        </CardDescription>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Avatar picker */}
        <div className="flex items-center gap-4">
          {/* Clicking the avatar triggers the hidden file input */}
          <div className="group relative cursor-pointer" onClick={handleAvatarClick}>
            <Avatar className="size-20 rounded-full">
              {/* Show either a local blob preview or the server avatar URL */}
              {avatarPreview && <AvatarImage src={avatarPreview} alt="Profile" />}
              <AvatarFallback className="rounded-full bg-primary/10 text-lg font-semibold text-primary">
                {user ? getInitials(user.name) : "??"}
              </AvatarFallback>
            </Avatar>
            {/* Camera overlay — only visible on hover */}
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <Camera className="size-5 text-white" />
            </div>
          </div>
          {/* Hidden real <input type="file"> — triggered by avatar click */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <div>
            <p className="text-sm font-medium">Profile Photo</p>
            <p className="text-xs text-muted-foreground">
              {avatarFile
                ? avatarFile.name
                : "Click the avatar to upload a new photo (max 10 MB)."}
            </p>
          </div>
        </div>

        <Separator className="bg-white/5" />

        {/* General error banner — shown for non-field API errors */}
        {submitError && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Full name — single field (API has a single `name` field) */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            placeholder="Enter your full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="transition-colors hover:border-primary/50 focus:border-primary"
          />
          {/* Per-field error: client-side or from a 422 server response */}
          {fieldErrors.name && (
            <p className="text-xs text-destructive">{fieldErrors.name}</p>
          )}
        </div>

        {/* Email address */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            placeholder="Enter email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="transition-colors hover:border-primary/50 focus:border-primary"
          />
          {fieldErrors.email && (
            <p className="text-xs text-destructive">{fieldErrors.email}</p>
          )}
        </div>

        {/* Avatar field-level error (e.g. file too large, wrong type) */}
        {fieldErrors.avatar && (
          <p className="text-xs text-destructive">{fieldErrors.avatar}</p>
        )}

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={submitting}
            className="transition-all hover:shadow-md hover:shadow-primary/25"
          >
            {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            {submitting ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// PasswordTab
// Lets the authenticated user change their password via
// POST /profile/password (application/json).
// ─────────────────────────────────────────────────────────────────
function PasswordTab() {
  // ── Form state ───────────────────────────────────────────────
  const [password, setPassword] = useState("")
  const [passwordConfirmation, setPasswordConfirmation] = useState("")
  // Visibility toggles for each field (eye icon)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // ── Submission state ─────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // ── Client-side validation ───────────────────────────────────
  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!password) next.password = "Password is required."
    else if (password.length < 8) next.password = "Password must be at least 8 characters."
    if (!passwordConfirmation) next.password_confirmation = "Please confirm your password."
    else if (password && password !== passwordConfirmation)
      next.password_confirmation = "Passwords do not match."
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  // ── Submit handler — calls POST /profile/password ────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    setSuccess(false)
    if (!validate()) return

    setSubmitting(true)
    try {
      await authService.updatePassword({
        password,
        password_confirmation: passwordConfirmation,
      })
      // Reset form fields and show an inline success message
      setPassword("")
      setPasswordConfirmation("")
      setFieldErrors({})
      setSuccess(true)
    } catch (error) {
      // Silently ignore request-cancel errors
      if (isCancel(error)) return
      // Surface per-field errors from a 422 response
      setFieldErrors(extractFieldErrors(error))
      setSubmitError(extractGeneralError(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Section header */}
      <div>
        <CardTitle className="text-lg">Change Password</CardTitle>
        <CardDescription className="mt-1">
          Update your password to keep your account secure.
        </CardDescription>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* General error banner */}
        {submitError && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Inline success message — shown after a successful password change */}
        {success && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-600 dark:text-green-400">
            Password updated successfully.
          </div>
        )}

        <Separator className="bg-white/5" />

        {/* New password with eye toggle */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="newPassword">New Password</Label>
          <div className="relative">
            <Input
              id="newPassword"
              type={showPassword ? "text" : "password"}
              placeholder="Enter new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-10 transition-colors hover:border-primary/50 focus:border-primary"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-1 top-1/2 -translate-y-1/2"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Must be at least 8 characters.</p>
          {/* Per-field error from client-side or 422 server response */}
          {fieldErrors.password && (
            <p className="text-xs text-destructive">{fieldErrors.password}</p>
          )}
        </div>

        {/* Confirm password with eye toggle */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirmPassword">Confirm New Password</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirm ? "text" : "password"}
              placeholder="Confirm new password"
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              className="pr-10 transition-colors hover:border-primary/50 focus:border-primary"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowConfirm((s) => !s)}
              className="absolute right-1 top-1/2 -translate-y-1/2"
              aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
            >
              {showConfirm ? <EyeOff /> : <Eye />}
            </Button>
          </div>
          {fieldErrors.password_confirmation && (
            <p className="text-xs text-destructive">{fieldErrors.password_confirmation}</p>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={submitting}
            className="transition-all hover:shadow-md hover:shadow-primary/25"
          >
            {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            {submitting ? "Updating…" : "Update Password"}
          </Button>
        </div>
      </form>
    </div>
  )
}

// ─── Tab definitions ─────────────────────────────────────────────
const tabs = [
  { id: "profile", label: "Profile", icon: User },
  { id: "password", label: "Password", icon: Lock },
] as const

type TabId = (typeof tabs)[number]["id"]

// ─────────────────────────────────────────────────────────────────
// AccountPage — root component
// Fetches the authenticated user on mount (GET /me) and passes the
// result down to the tab that needs it.
// ─────────────────────────────────────────────────────────────────
export default function AccountPage() {
  const [activeTab, setActiveTab] = useState<TabId>("profile")

  // ── GET /me state ────────────────────────────────────────────
  const [user, setUser] = useState<UserType | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Fetch the authenticated user on first render
  useEffect(() => {
    let cancelled = false // guard against state updates after unmount

    async function fetchMe() {
      setLoadingUser(true)
      setLoadError(null)
      try {
        const data = await authService.getMe()
        if (!cancelled) setUser(data)
      } catch (error) {
        // Don't surface cancel errors (React strict-mode double-mount in dev)
        if (isCancel(error)) return
        if (!cancelled) setLoadError(extractGeneralError(error))
      } finally {
        if (!cancelled) setLoadingUser(false)
      }
    }

    void fetchMe()
    return () => { cancelled = true }
  }, [])

  // Called by ProfileTab after a successful POST /profile
  function handleProfileSaved(updated: UserType) {
    setUser(updated)
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 min-w-0 md:gap-6 md:p-6">
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Account</h2>
        <p className="text-muted-foreground">
          Manage your profile and security settings.
        </p>
      </div>

      {/* Full-page error — only shown when GET /me fails and we have no cached user */}
      {loadError && !user && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-destructive/30 bg-destructive/10 p-8 text-center text-destructive">
          <AlertCircle className="size-8" />
          <p className="text-sm font-medium">{loadError}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="gap-2"
          >
            <RefreshCw className="size-4" />
            Retry
          </Button>
        </div>
      )}

      {/* Main layout: sidebar nav + card — visible once we have data (or after error is cleared) */}
      {(!loadError || user) && (
        <div className="flex flex-col gap-6 min-w-0 md:flex-row">
          {/* Side tab navigation */}
          <nav className="flex shrink-0 flex-row gap-1 md:w-48 md:flex-col">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                    : "text-muted-foreground hover:bg-white/5 hover:text-accent-foreground"
                }`}
              >
                <tab.icon className="size-4" />
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Tab content — single Card container, no nested cards */}
          <Card className="min-w-0 flex-1 rounded-xl">
            <CardContent className="p-6">
              {activeTab === "profile" && (
                <ProfileTab
                  user={user}
                  loadingUser={loadingUser}
                  onProfileSaved={handleProfileSaved}
                />
              )}
              {activeTab === "password" && <PasswordTab />}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}


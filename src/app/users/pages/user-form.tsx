import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react"
import { RolesPermissionsSection } from "@/components/roles-permissions-section"
import { RoleSection } from "@/components/role-section"
import { useRolesPermissions } from "@/hooks/useRolesPermissions"
import type { User } from "@/app/users/data"

type UserFormProps = {
  mode: "create" | "edit"
  initialData?: User | null
  /** True while the API request is in-flight */
  submitting?: boolean
  /** Backend / network error message to display */
  submitError?: string | null
  onSubmit: (data: UserFormData) => Promise<string | null>
  onCancel: () => void
  /** Called after both personal-info save and roles/permissions sync succeed */
  onSuccess?: () => void
}

// Data shape sent from the form to the parent
export type UserFormData = {
  name: string
  email: string
  password: string
}

export function UserForm({
  mode,
  initialData,
  submitting = false,
  submitError,
  onSubmit,
  onCancel,
  onSuccess,
}: UserFormProps) {
  const [name, setName] = useState(initialData?.name ?? "")
  const [email, setEmail] = useState(initialData?.email ?? "")
  // Password is required on create, optional on edit
  const [password, setPassword] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  // ── Roles & Permissions ─────────────────────────────────────────────────────
  const {
    availableRoles,
    availablePermissions,
    currentRoles,
    currentPermissions,
    inheritedPermissions,
    isDirty: rolesPermsDirty,
    loading: rolesPermsLoading,
    error: rolesPermsError,
    syncing,
    setCurrentRoles,
    toggleRole,
    togglePermission,
    saveChanges,
    fetchAvailable,
  } = useRolesPermissions({ userId: initialData?.id })

  // Derive the single selected role for the RoleSection picker
  const selectedRole = currentRoles[0] ?? ""

  function handleSelectRole(roleName: string) {
    setCurrentRoles(roleName ? [roleName] : [])
  }

  const isBusy = submitting || syncing

  // Reset fields when switching between create ↔ edit
  useEffect(() => {
    setName(initialData?.name ?? "")
    setEmail(initialData?.email ?? "")
    setPassword("")
  }, [initialData])

  // ── Client-side validation ──────────────────────────────────────────────────
  function validate() {
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = "Name is required"
    if (!email.trim()) next.email = "Email is required"
    else if (!/\S+@\S+\.\S+/.test(email)) next.email = "Enter a valid email"
    // Password is required for new users; optional for edits
    if (mode === "create" && !password) next.password = "Password is required"
    if (password && password.length < 8) next.password = "Password must be at least 8 characters"
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    // Two-phase submit: 1) save personal info, 2) sync roles/permissions
    void (async () => {
      const userId = await onSubmit({
        name,
        email,
        password,
      })
      if (!userId) return

      if (rolesPermsDirty) {
        const syncOk = await saveChanges(userId)
        if (!syncOk) return
      }

      onSuccess?.()
    })()
  }

  return (
    <div className="flex w-full justify-center p-4 md:p-8">
      <Card className="w-full max-w-4xl">
        <CardContent className="p-6 md:p-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon-lg" onClick={onCancel} disabled={isBusy}>
              <ArrowLeft />
            </Button>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
                  {mode === "create" ? "Create User" : "Edit User"}
                </h2>
                <Badge variant="secondary" className="uppercase tracking-wider">
                  {mode}
                </Badge>
              </div>
              <p className="text-sm md:text-lg text-muted-foreground max-w-2xl">
                {mode === "create"
                  ? "Add a new member to your organization."
                  : `Update account details for ${initialData?.name ?? "this user"}.`}
              </p>
            </div>
          </div>

          {/* Backend / network error banner */}
          {submitError && (
            <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive mb-6">
              <AlertCircle className="size-4 shrink-0" />
              <span className="flex-1">{submitError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Personal Information */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold uppercase tracking-widest text-muted-foreground">
                  Personal Information
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter full name"
                    className="h-12 text-sm"
                    disabled={isBusy}
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive mt-1">{errors.name}</p>
                  )}
                </div>
                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter email address"
                    className="h-12 text-sm"
                    disabled={isBusy}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive mt-1">{errors.email}</p>
                  )}
                </div>
                {/* Password */}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="password">
                    Password{mode === "edit" && <span className="text-muted-foreground ml-1">(leave blank to keep current)</span>}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "create" ? "Enter password" : "New password (optional)"}
                    className="h-12 text-sm"
                    disabled={isBusy}
                    autoComplete="new-password"
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive mt-1">{errors.password}</p>
                  )}
                </div>
              </div>
            </section>

            <Separator />

            {/* Role (primary role selector + permissions preview) */}
            <RoleSection
              availableRoles={availableRoles}
              selectedRole={selectedRole}
              onSelectRole={handleSelectRole}
              disabled={isBusy}
              loading={rolesPermsLoading}
            />

            <Separator />

            {/* Direct Permissions — roles managed above via RoleSection */}
            <RolesPermissionsSection
              availableRoles={availableRoles}
              availablePermissions={availablePermissions}
              selectedRoles={currentRoles}
              selectedPermissions={currentPermissions}
              inheritedPermissions={inheritedPermissions}
              onToggleRole={toggleRole}
              onTogglePermission={togglePermission}
              disabled={isBusy}
              loading={rolesPermsLoading}
              error={rolesPermsError}
              onRetry={fetchAvailable}
              hideRoles
            />

            <Separator />

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <Button type="button" variant="ghost" size="lg" onClick={onCancel} disabled={isBusy}>
                Discard
              </Button>
              <Button type="submit" size="lg" disabled={isBusy}>
                {isBusy && <Loader2 className="size-4 animate-spin" />}
                {mode === "create" ? "Create User" : "Save Changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

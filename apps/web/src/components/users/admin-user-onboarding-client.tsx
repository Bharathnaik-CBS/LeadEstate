"use client"

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { Loader2, RefreshCw, UserPlus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getFriendlyApiError } from "@/lib/api"
import { getToken } from "@/lib/auth"
import type { AuthUser, OnboardingStatus, UserRole } from "@/lib/auth"
import { formatLocalDateTime } from "@/lib/date"
import { createUser, getManagedUsers } from "@/lib/users"

type ManagedRole = Exclude<UserRole, "ADMIN">
type ManagedStatus = Extract<OnboardingStatus, "ACTIVE" | "REJECTED">

type FormState = {
  name: string
  email: string
  password: string
  role: ManagedRole
  onboardingStatus: ManagedStatus
}

const ROLE_OPTIONS: Array<{ value: ManagedRole; label: string }> = [
  { value: "SALES_EXECUTIVE", label: "Sales Executive / SE" },
  { value: "PROJECT_INVENTORY_MANAGER", label: "Project Inventory Manager / PIM" },
  { value: "SITE_VISIT_COORDINATOR", label: "Site Visit Coordinator / SVC" },
]

const STATUS_OPTIONS: Array<{ value: ManagedStatus; label: string }> = [
  { value: "ACTIVE", label: "Active" },
  { value: "REJECTED", label: "Inactive" },
]

const initialForm: FormState = {
  name: "",
  email: "",
  password: "",
  role: "SALES_EXECUTIVE",
  onboardingStatus: "ACTIVE",
}

export function AdminUserOnboardingClient() {
  const [users, setUsers] = useState<AuthUser[]>([])
  const [form, setForm] = useState<FormState>(initialForm)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const roleCounts = useMemo(
    () =>
      ROLE_OPTIONS.map((role) => ({
        ...role,
        count: users.filter((user) => user.role === role.value).length,
      })),
    [users]
  )

  const loadUsers = useCallback(async () => {
    const token = getToken()

    if (!token) {
      setError("Your session has expired. Please log in again.")
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      setUsers(await getManagedUsers(token))
    } catch (err) {
      setError(getFriendlyApiError(err, "Unable to load users"))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(loadUsers)
  }, [loadUsers])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    const validationError = validateForm(form)

    if (validationError) {
      setError(validationError)
      return
    }

    const token = getToken()

    if (!token) {
      setError("Your session has expired. Please log in again.")
      return
    }

    setIsSubmitting(true)

    try {
      const createdUser = await createUser(token, form)
      setSuccess(`${createdUser.name} was added successfully.`)
      setForm(initialForm)
      await loadUsers()
    } catch (err) {
      setError(getFriendlyApiError(err, "Unable to create user"))
    } finally {
      setIsSubmitting(false)
    }
  }

  function updateField<Key extends keyof FormState>(
    key: Key,
    value: FormState[Key]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(340px,0.85fr)_minmax(0,1.15fr)]">
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Add user</CardTitle>
          <CardDescription>
            Create SE, PIM, and SVC accounts for the demo workflows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
            <Field label="Name" htmlFor="managed-user-name">
              <Input
                id="managed-user-name"
                value={form.name}
                disabled={isSubmitting}
                onChange={(event) => updateField("name", event.target.value)}
              />
            </Field>
            <Field label="Email" htmlFor="managed-user-email">
              <Input
                id="managed-user-email"
                type="email"
                value={form.email}
                disabled={isSubmitting}
                onChange={(event) => updateField("email", event.target.value)}
              />
            </Field>
            <Field label="Temporary password" htmlFor="managed-user-password">
              <Input
                id="managed-user-password"
                type="password"
                value={form.password}
                disabled={isSubmitting}
                onChange={(event) => updateField("password", event.target.value)}
              />
            </Field>
            <Field label="Role" htmlFor="managed-user-role">
              <Select
                value={form.role}
                disabled={isSubmitting}
                onValueChange={(value) =>
                  updateField("role", value as ManagedRole)
                }
              >
                <SelectTrigger id="managed-user-role" className="w-full">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status" htmlFor="managed-user-status">
              <Select
                value={form.onboardingStatus}
                disabled={isSubmitting}
                onValueChange={(value) =>
                  updateField("onboardingStatus", value as ManagedStatus)
                }
              >
                <SelectTrigger id="managed-user-status" className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {error ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {success}
              </p>
            ) : null}

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <UserPlus className="size-4" />
              )}
              {isSubmitting ? "Creating..." : "Create user"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {roleCounts.map((role) => (
            <Card key={role.value} className="rounded-lg" size="sm">
              <CardContent>
                <p className="text-xs text-muted-foreground">{role.label}</p>
                <p className="mt-2 text-2xl font-semibold">{role.count}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="rounded-lg">
          <CardHeader className="gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <CardTitle>Managed users</CardTitle>
              <CardDescription>
                Active and inactive non-admin accounts.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              className="justify-self-start sm:justify-self-end"
              onClick={loadUsers}
              disabled={isLoading}
            >
              <RefreshCw className="size-4" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" />
                Loading users...
              </div>
            ) : users.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                No managed users have been added yet.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <div className="grid grid-cols-[1.15fr_1fr_0.8fr_0.7fr] gap-3 bg-muted/60 px-4 py-3 text-xs font-medium text-muted-foreground">
                  <span>Name</span>
                  <span>Email</span>
                  <span>Role</span>
                  <span>Status</span>
                </div>
                <div className="divide-y">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="grid grid-cols-[1.15fr_1fr_0.8fr_0.7fr] gap-3 px-4 py-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{user.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatLocalDateTime(user.createdAt)}
                        </p>
                      </div>
                      <span className="min-w-0 truncate">{user.email}</span>
                      <span>{getRoleLabel(user.role)}</span>
                      <Badge
                        variant={
                          user.onboardingStatus === "ACTIVE"
                            ? "secondary"
                            : "outline"
                        }
                        className="rounded-md"
                      >
                        {user.onboardingStatus === "ACTIVE"
                          ? "Active"
                          : "Inactive"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

function validateForm(form: FormState) {
  if (!form.name.trim()) {
    return "Enter the user's name."
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    return "Enter a valid email address."
  }

  if (
    form.password.length < 12 ||
    !/[a-z]/.test(form.password) ||
    !/[A-Z]/.test(form.password) ||
    !/\d/.test(form.password) ||
    !/[^A-Za-z0-9]/.test(form.password)
  ) {
    return "Temporary password must include uppercase, lowercase, number, and special character."
  }

  return null
}

function getRoleLabel(role: UserRole) {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role
}

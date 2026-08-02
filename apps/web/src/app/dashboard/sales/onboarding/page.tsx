"use client"

import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react"
import { useRouter } from "next/navigation"
import { Building2, Loader2, LogOut, RefreshCw } from "lucide-react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { DashboardLoading } from "@/components/dashboard/dashboard-state"
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
import { useToast } from "@/components/ui/toast"
import { getFriendlyApiError } from "@/lib/api"
import {
  getDashboardPathForRole,
  getSalesOnboardingStatus,
  getToken,
  logout,
  saveAuthSession,
  type AuthUser,
  type Gender,
  type OnboardingStatus,
} from "@/lib/auth"
import {
  changePasswordWithOtp,
  completeSalesProfile,
  generatePasswordOtp,
  getMe,
} from "@/lib/users"

type ProfileForm = {
  firstName: string
  lastName: string
  username: string
  phoneNumber: string
  dob: string
  gender: Gender | ""
}

type PasswordForm = {
  otp: string
  newPassword: string
}

type ProfileFormErrors = Partial<Record<keyof ProfileForm, string>>
type PasswordFormErrors = Partial<Record<keyof PasswordForm, string>>

const initialProfileForm: ProfileForm = {
  firstName: "",
  lastName: "",
  username: "",
  phoneNumber: "",
  dob: "",
  gender: "",
}

const initialPasswordForm: PasswordForm = {
  otp: "",
  newPassword: "",
}

const ONBOARDING_STATUS_DETAILS: Record<
  OnboardingStatus,
  {
    title: string
    description: string
  }
> = {
  CREATED: {
    title: "Account created",
    description:
      "Your sales executive account has been created. Refresh to check when admin approval begins.",
  },
  PENDING_ADMIN_APPROVAL: {
    title: "Waiting for admin approval",
    description:
      "An admin must approve your account before you can complete your profile.",
  },
  PROFILE_INCOMPLETE: {
    title: "Complete your profile",
    description:
      "Add your profile details to continue to password setup.",
  },
  PASSWORD_CHANGE_REQUIRED: {
    title: "Set your new password",
    description:
      "Generate the OTP for this step, then enter it with your new password to activate your account.",
  },
  ACTIVE: {
    title: "Onboarding complete",
    description: "Your account is active.",
  },
  REJECTED: {
    title: "Onboarding request rejected",
    description:
      "Contact the admin team if you think this needs to be reviewed.",
  },
}

export default function SalesOnboardingPage() {
  return (
    <ProtectedRoute allowedRoles={["SALES_EXECUTIVE"]}>
      {(user) => <SalesOnboardingClient initialUser={user} />}
    </ProtectedRoute>
  )
}

function SalesOnboardingClient({ initialUser }: { initialUser: AuthUser }) {
  const router = useRouter()
  const toast = useToast()
  const formId = useId()
  const [user, setUser] = useState<AuthUser>(initialUser)
  const [profileForm, setProfileForm] =
    useState<ProfileForm>(initialProfileForm)
  const [passwordForm, setPasswordForm] =
    useState<PasswordForm>(initialPasswordForm)
  const [profileErrors, setProfileErrors] = useState<ProfileFormErrors>({})
  const [passwordErrors, setPasswordErrors] = useState<PasswordFormErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [hasCompletedInitialRefresh, setHasCompletedInitialRefresh] =
    useState(false)
  const [isRefreshing, setIsRefreshing] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isGeneratingOtp, setIsGeneratingOtp] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  const token = useMemo(() => getToken(), [])
  const status = getSalesOnboardingStatus(user)
  const statusDetails = ONBOARDING_STATUS_DETAILS[status]
  const getProfileErrorId = useCallback(
    (field: keyof ProfileForm) => `${formId}-profile-${field}-error`,
    [formId]
  )
  const getPasswordErrorId = useCallback(
    (field: keyof PasswordForm) => `${formId}-password-${field}-error`,
    [formId]
  )
  const isProfileBusy = isRefreshing || isSavingProfile
  const isPasswordBusy = isRefreshing || isGeneratingOtp || isChangingPassword

  const persistUser = useCallback(
    (updatedUser: AuthUser) => {
      if (!token) {
        return
      }

      setUser(updatedUser)
      saveAuthSession({
        accessToken: token,
        user: updatedUser,
      })
    },
    [token]
  )

  const refreshStatus = useCallback(async (showToast = false) => {
    if (!token) {
      const message = "Your session has expired. Please log in again."
      setError(message)
      toast.error("Unable to refresh onboarding status", message)
      setIsRefreshing(false)
      setHasCompletedInitialRefresh(true)
      return
    }

    setIsRefreshing(true)
    setError(null)

    try {
      const updatedUser = await getMe(token)
      persistUser(updatedUser)

      if (getSalesOnboardingStatus(updatedUser) === "ACTIVE") {
        if (showToast) {
          toast.success("Onboarding refreshed", "Your account is active.")
        }
        router.replace(getDashboardPathForRole(updatedUser.role))
      } else if (showToast) {
        toast.success("Onboarding refreshed", "Your latest status is showing.")
      }
    } catch (err) {
      const message = getFriendlyApiError(
        err,
        "Unable to refresh onboarding status"
      )
      setError(message)
      toast.error("Unable to refresh onboarding status", message)
    } finally {
      setIsRefreshing(false)
      setHasCompletedInitialRefresh(true)
    }
  }, [persistUser, router, toast, token])

  useEffect(() => {
    void Promise.resolve().then(() => refreshStatus(false))
  }, [refreshStatus])

  function handleLogout() {
    logout(router)
  }

  function updateProfileField<Key extends keyof ProfileForm>(
    key: Key,
    value: ProfileForm[Key]
  ) {
    setProfileErrors((current) => ({
      ...current,
      [key]: undefined,
    }))
    setError(null)

    setProfileForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function updatePasswordField<Key extends keyof PasswordForm>(
    key: Key,
    value: PasswordForm[Key]
  ) {
    setPasswordErrors((current) => ({
      ...current,
      [key]: undefined,
    }))
    setError(null)

    setPasswordForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationErrors = validateProfileForm(profileForm)

    if (Object.keys(validationErrors).length > 0) {
      setProfileErrors(validationErrors)
      setError("Complete the required profile fields before continuing.")
      return
    }

    if (!token || !profileForm.gender) {
      const message = "Your session has expired. Please log in again."
      setError(message)
      toast.error("Unable to save profile", message)
      return
    }

    setIsSavingProfile(true)
    setError(null)
    setMessage(null)
    setProfileErrors({})

    try {
      const updatedUser = await completeSalesProfile(token, {
        ...profileForm,
        gender: profileForm.gender,
      })
      persistUser(updatedUser)
      setMessage("Profile saved. Generate the OTP to set your new password.")
      toast.success(
        "Profile saved",
        "Generate the OTP to set your new password."
      )
    } catch (err) {
      const message = getFriendlyApiError(err, "Unable to save profile")
      setError(message)
      toast.error("Unable to save profile", message)
    } finally {
      setIsSavingProfile(false)
    }
  }

  async function handleGenerateOtp() {
    if (!token) {
      const message = "Your session has expired. Please log in again."
      setError(message)
      toast.error("Unable to generate OTP", message)
      return
    }

    setIsGeneratingOtp(true)
    setError(null)
    setMessage(null)

    try {
      const response = await generatePasswordOtp(token)
      setMessage(response.message)
      toast.success("OTP generated", response.message)
    } catch (err) {
      const message = getFriendlyApiError(err, "Unable to generate OTP")
      setError(message)
      toast.error("Unable to generate OTP", message)
    } finally {
      setIsGeneratingOtp(false)
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationErrors = validatePasswordForm(passwordForm)

    if (Object.keys(validationErrors).length > 0) {
      setPasswordErrors(validationErrors)
      setError("Enter the OTP and a valid new password before activating.")
      return
    }

    if (!token) {
      const message = "Your session has expired. Please log in again."
      setError(message)
      toast.error("Unable to change password", message)
      return
    }

    setIsChangingPassword(true)
    setError(null)
    setMessage(null)
    setPasswordErrors({})

    try {
      const updatedUser = await changePasswordWithOtp(token, passwordForm)
      persistUser(updatedUser)
      toast.success("Password changed", "Your sales account is active.")
      router.replace("/dashboard/sales")
    } catch (err) {
      const message = getFriendlyApiError(err, "Unable to change password")
      setError(message)
      toast.error("Unable to change password", message)
    } finally {
      setIsChangingPassword(false)
    }
  }

  if (!hasCompletedInitialRefresh && isRefreshing) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
        <div className="w-full max-w-2xl">
          <DashboardLoading
            title="Checking onboarding status"
            description="Refreshing your account status before showing the next step."
            rows={0}
            sections={0}
          />
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <Card className="w-full max-w-2xl rounded-lg">
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <span className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="size-6" />
            </span>
            <Button type="button" variant="outline" onClick={handleLogout}>
              <LogOut className="size-4" />
              Logout
            </Button>
          </div>
          <div>
            <CardTitle>Sales Executive Onboarding</CardTitle>
            <CardDescription>
              {user.email} - {statusDetails.title}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {error ? <Alert tone="error" message={error} /> : null}
          {message ? <Alert tone="success" message={message} /> : null}

          {status === "CREATED" ||
          status === "PENDING_ADMIN_APPROVAL" ||
          status === "REJECTED" ? (
            <WaitingState
              status={status}
              details={statusDetails}
              isRefreshing={isRefreshing}
              onRefresh={() => refreshStatus(true)}
            />
          ) : null}

          {status === "PROFILE_INCOMPLETE" ? (
            <form className="grid gap-4" noValidate onSubmit={handleProfileSubmit}>
              <StatusIntro details={statusDetails} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="First name"
                  htmlFor="firstName"
                  required
                  error={profileErrors.firstName}
                  errorId={getProfileErrorId("firstName")}
                >
                  <Input
                    id="firstName"
                    value={profileForm.firstName}
                    disabled={isProfileBusy}
                    aria-required="true"
                    aria-invalid={Boolean(profileErrors.firstName)}
                    aria-describedby={
                      profileErrors.firstName
                        ? getProfileErrorId("firstName")
                        : undefined
                    }
                    onChange={(event) =>
                      updateProfileField("firstName", event.target.value)
                    }
                  />
                </Field>
                <Field
                  label="Last name"
                  htmlFor="lastName"
                  required
                  error={profileErrors.lastName}
                  errorId={getProfileErrorId("lastName")}
                >
                  <Input
                    id="lastName"
                    value={profileForm.lastName}
                    disabled={isProfileBusy}
                    aria-required="true"
                    aria-invalid={Boolean(profileErrors.lastName)}
                    aria-describedby={
                      profileErrors.lastName
                        ? getProfileErrorId("lastName")
                        : undefined
                    }
                    onChange={(event) =>
                      updateProfileField("lastName", event.target.value)
                    }
                  />
                </Field>
                <Field
                  label="Username"
                  htmlFor="username"
                  required
                  error={profileErrors.username}
                  errorId={getProfileErrorId("username")}
                >
                  <Input
                    id="username"
                    value={profileForm.username}
                    disabled={isProfileBusy}
                    aria-required="true"
                    aria-invalid={Boolean(profileErrors.username)}
                    aria-describedby={
                      profileErrors.username
                        ? getProfileErrorId("username")
                        : undefined
                    }
                    onChange={(event) =>
                      updateProfileField("username", event.target.value)
                    }
                  />
                </Field>
                <Field
                  label="Phone number"
                  htmlFor="phoneNumber"
                  required
                  error={profileErrors.phoneNumber}
                  errorId={getProfileErrorId("phoneNumber")}
                >
                  <Input
                    id="phoneNumber"
                    value={profileForm.phoneNumber}
                    disabled={isProfileBusy}
                    aria-required="true"
                    aria-invalid={Boolean(profileErrors.phoneNumber)}
                    aria-describedby={
                      profileErrors.phoneNumber
                        ? getProfileErrorId("phoneNumber")
                        : undefined
                    }
                    onChange={(event) =>
                      updateProfileField("phoneNumber", event.target.value)
                    }
                  />
                </Field>
                <Field
                  label="DOB"
                  htmlFor="dob"
                  required
                  error={profileErrors.dob}
                  errorId={getProfileErrorId("dob")}
                >
                  <Input
                    id="dob"
                    type="date"
                    value={profileForm.dob}
                    disabled={isProfileBusy}
                    aria-required="true"
                    aria-invalid={Boolean(profileErrors.dob)}
                    aria-describedby={
                      profileErrors.dob ? getProfileErrorId("dob") : undefined
                    }
                    onChange={(event) =>
                      updateProfileField("dob", event.target.value)
                    }
                  />
                </Field>
                <Field
                  label="Gender"
                  htmlFor="gender"
                  required
                  error={profileErrors.gender}
                  errorId={getProfileErrorId("gender")}
                >
                  <Select
                    value={profileForm.gender}
                    disabled={isProfileBusy}
                    onValueChange={(value) =>
                      updateProfileField("gender", value as Gender)
                    }
                  >
                    <SelectTrigger
                      id="gender"
                      className="w-full"
                      aria-label="Gender"
                      aria-required="true"
                      aria-invalid={Boolean(profileErrors.gender)}
                      aria-describedby={
                        profileErrors.gender
                          ? getProfileErrorId("gender")
                          : undefined
                      }
                    >
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE">Male</SelectItem>
                      <SelectItem value="FEMALE">Female</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                      <SelectItem value="PREFER_NOT_TO_SAY">
                        Prefer not to say
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Button
                type="submit"
                disabled={isProfileBusy}
                aria-busy={isSavingProfile}
              >
                {isSavingProfile ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                {isSavingProfile ? "Saving..." : "Save Profile"}
              </Button>
            </form>
          ) : null}

          {status === "PASSWORD_CHANGE_REQUIRED" ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                <StatusIntro details={statusDetails} />
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPasswordBusy}
                  aria-busy={isGeneratingOtp}
                  onClick={handleGenerateOtp}
                >
                  {isGeneratingOtp ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  {isGeneratingOtp ? "Generating..." : "Generate OTP"}
                </Button>
              </div>

              <form className="grid gap-4" noValidate onSubmit={handlePasswordSubmit}>
                <Field
                  label="OTP"
                  htmlFor="otp"
                  required
                  error={passwordErrors.otp}
                  errorId={getPasswordErrorId("otp")}
                  hint="Enter the 6-digit OTP sent for password setup."
                  hintId={`${formId}-password-otp-hint`}
                >
                  <Input
                    id="otp"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    autoComplete="one-time-code"
                    value={passwordForm.otp}
                    disabled={isPasswordBusy}
                    aria-required="true"
                    aria-invalid={Boolean(passwordErrors.otp)}
                    aria-describedby={
                      passwordErrors.otp
                        ? getPasswordErrorId("otp")
                        : `${formId}-password-otp-hint`
                    }
                    onChange={(event) =>
                      updatePasswordField("otp", event.target.value)
                    }
                  />
                </Field>
                <Field
                  label="New password"
                  htmlFor="newPassword"
                  required
                  error={passwordErrors.newPassword}
                  errorId={getPasswordErrorId("newPassword")}
                  hint="Use at least 12 characters."
                  hintId={`${formId}-password-newPassword-hint`}
                >
                  <Input
                    id="newPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    value={passwordForm.newPassword}
                    disabled={isPasswordBusy}
                    aria-required="true"
                    aria-invalid={Boolean(passwordErrors.newPassword)}
                    aria-describedby={
                      passwordErrors.newPassword
                        ? getPasswordErrorId("newPassword")
                        : `${formId}-password-newPassword-hint`
                    }
                    onChange={(event) =>
                      updatePasswordField("newPassword", event.target.value)
                    }
                  />
                </Field>
                <Button
                  type="submit"
                  disabled={isPasswordBusy}
                  aria-busy={isChangingPassword}
                >
                  {isChangingPassword ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  {isChangingPassword ? "Activating..." : "Change Password"}
                </Button>
              </form>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  )
}

function validateProfileForm(form: ProfileForm): ProfileFormErrors {
  const errors: ProfileFormErrors = {}

  if (!form.firstName.trim()) {
    errors.firstName = "Enter your first name."
  }

  if (!form.lastName.trim()) {
    errors.lastName = "Enter your last name."
  }

  if (!form.username.trim()) {
    errors.username = "Enter a username."
  }

  if (!form.phoneNumber.trim()) {
    errors.phoneNumber = "Enter your phone number."
  }

  if (!form.dob) {
    errors.dob = "Select your date of birth."
  }

  if (!form.gender) {
    errors.gender = "Select your gender."
  }

  return errors
}

function validatePasswordForm(form: PasswordForm): PasswordFormErrors {
  const errors: PasswordFormErrors = {}

  if (!/^\d{6}$/.test(form.otp.trim())) {
    errors.otp = "Enter the 6-digit OTP."
  }

  if (form.newPassword.length < 12) {
    errors.newPassword = "Use at least 12 characters."
  }

  return errors
}

function WaitingState({
  status,
  details,
  isRefreshing,
  onRefresh,
}: {
  status: OnboardingStatus
  details: {
    title: string
    description: string
  }
  isRefreshing: boolean
  onRefresh: () => void
}) {
  const isRejected = status === "REJECTED"

  return (
    <div className="space-y-4 rounded-lg border border-dashed p-6">
      <StatusIntro details={details} />
      {!isRejected ? (
        <Button
          type="button"
          variant="outline"
          disabled={isRefreshing}
          aria-busy={isRefreshing}
          onClick={onRefresh}
        >
          {isRefreshing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {isRefreshing ? "Refreshing..." : "Refresh Status"}
        </Button>
      ) : null}
    </div>
  )
}

function StatusIntro({
  details,
}: {
  details: {
    title: string
    description: string
  }
}) {
  return (
    <div>
      <p className="font-medium">{details.title}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {details.description}
      </p>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  required,
  error,
  errorId,
  hint,
  hintId,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  error?: string
  errorId?: string
  hint?: string
  hintId?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="flex items-center gap-2">
        {label}
        {required ? (
          <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
            Required
          </span>
        ) : null}
      </Label>
      {children}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

function Alert({
  tone,
  message,
}: {
  tone: "error" | "success"
  message: string
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={
        tone === "error"
          ? "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          : "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
      }
    >
      {message}
    </div>
  )
}

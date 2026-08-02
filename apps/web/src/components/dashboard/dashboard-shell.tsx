"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  BarChart3,
  Blocks,
  Building2,
  CalendarClock,
  FileText,
  LogOut,
  Map,
  Menu,
  PlusCircle,
  Shield,
  TrendingUp,
  Truck,
  type LucideIcon,
  UserRound,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  getDashboardPathForRole,
  logout,
  type AuthUser,
} from "@/lib/auth"

type DashboardShellProps = {
  user: AuthUser
  title: string
  description: string
  children: ReactNode
}

type DashboardNavItem = {
  href: string
  label: string
  icon: LucideIcon
}

export function DashboardShell({
  user,
  title,
  description,
  children,
}: DashboardShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const dashboardHref = getDashboardPathForRole(user.role)
  const roleLabel = getRoleLabel(user.role)
  const navItems = getNavItems(user, dashboardHref)

  function handleLogout() {
    logout(router)
  }

  return (
    <main className="min-h-screen bg-muted/30 text-foreground print:bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-background print:hidden lg:block">
        <div className="flex h-full flex-col">
          <BrandBlock />

          <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Primary">
            {navItems.map((item) => (
              <DashboardNavLink
                key={item.href}
                item={item}
                isActive={isNavItemActive(item.href, pathname, dashboardHref)}
              />
            ))}
          </nav>

          <div className="border-t p-4">
            <div className="mb-3 flex items-start gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
                {user.role === "ADMIN" ? (
                  <Shield className="size-4" />
                ) : (
                  <UserRound className="size-4" />
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={handleLogout}
            >
              <LogOut className="size-4" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      <div className="print:pl-0 lg:pl-64">
        <header className="sticky top-0 z-10 border-b bg-background/95 px-4 py-3 backdrop-blur print:hidden sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="lg:hidden"
                aria-label="Open navigation menu"
                aria-expanded={isMobileNavOpen}
                onClick={() => setIsMobileNavOpen(true)}
              >
                <Menu className="size-4" />
              </Button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 lg:hidden">
                  <Building2 className="size-5" />
                  <span className="text-sm font-semibold">Lead Estate</span>
                </div>
                <h1 className="mt-1 text-xl font-semibold tracking-normal sm:mt-0">
                  {title}
                </h1>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="hidden rounded-md sm:inline-flex">
                {roleLabel}
              </Badge>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Logout"
                onClick={handleLogout}
              >
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>
        </header>

        <section className="px-4 py-6 print:px-0 print:py-0 sm:px-6">
          {children}
        </section>
      </div>

      <Dialog open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
        <DialogContent className="left-0 top-0 h-dvh max-w-80 translate-x-0 translate-y-0 content-start rounded-none p-0 sm:max-w-80">
          <DialogHeader className="p-0">
            <BrandBlock />
            <DialogTitle className="sr-only">Lead Estate navigation</DialogTitle>
            <DialogDescription className="sr-only">
              Navigate Lead Estate as {roleLabel}.
            </DialogDescription>
          </DialogHeader>

          <div className="flex h-[calc(100dvh-4rem)] flex-col">
            <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Mobile primary">
              {navItems.map((item) => (
                <DashboardNavLink
                  key={item.href}
                  item={item}
                  isActive={isNavItemActive(item.href, pathname, dashboardHref)}
                  onNavigate={() => setIsMobileNavOpen(false)}
                />
              ))}
            </nav>

            <div className="border-t p-4">
              <UserSummary user={user} />
              <Button
                type="button"
                variant="outline"
                className="mt-3 w-full justify-start gap-2"
                onClick={handleLogout}
              >
                <LogOut className="size-4" />
                Logout
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function getRoleLabel(role: AuthUser["role"]) {
  if (role === "ADMIN") {
    return "Administrator"
  }

  if (role === "PROJECT_INVENTORY_MANAGER") {
    return "PIM"
  }

  if (role === "SITE_VISIT_COORDINATOR") {
    return "SVC"
  }

  return "Sales Executive"
}

function getNavItems(user: AuthUser, dashboardHref: string): DashboardNavItem[] {
  if (user.role === "ADMIN") {
    return [
      {
        href: dashboardHref,
        label: "Dashboard",
        icon: BarChart3,
      },
      {
        href: "/dashboard/admin/leads",
        label: "Leads",
        icon: Building2,
      },
      {
        href: "/dashboard/admin/users",
        label: "Users",
        icon: Users,
      },
      {
        href: "/dashboard/admin/reports",
        label: "Reports",
        icon: FileText,
      },
      {
        href: "/dashboard/admin/activity",
        label: "Activity Log",
        icon: FileText,
      },
      {
        href: "/dashboard/admin#performance",
        label: "Performance",
        icon: TrendingUp,
      },
    ]
  }

  if (user.role === "PROJECT_INVENTORY_MANAGER") {
    return [
      {
        href: dashboardHref,
        label: "Dashboard",
        icon: BarChart3,
      },
      {
        href: "/dashboard/pim/projects",
        label: "Projects",
        icon: Building2,
      },
      {
        href: "/dashboard/pim/plots",
        label: "Plots/Layout",
        icon: Map,
      },
      {
        href: "/dashboard/pim/blocks",
        label: "Blocks/Bookings",
        icon: Blocks,
      },
    ]
  }

  if (user.role === "SITE_VISIT_COORDINATOR") {
    return [
      {
        href: dashboardHref,
        label: "Dashboard",
        icon: BarChart3,
      },
      {
        href: "/dashboard/svc/site-visits",
        label: "Site Visits",
        icon: CalendarClock,
      },
      {
        href: "/dashboard/svc/vehicles",
        label: "Vehicles",
        icon: Truck,
      },
      {
        href: "/dashboard/svc/drivers",
        label: "Drivers",
        icon: UserRound,
      },
    ]
  }

  return [
    {
      href: dashboardHref,
      label: "Dashboard",
      icon: BarChart3,
    },
    {
      href: "/dashboard/sales/leads",
      label: "My Leads",
      icon: Building2,
    },
    {
      href: "/dashboard/sales/booking",
      label: "Bookings",
      icon: FileText,
    },
    {
      href: "/dashboard/sales/customers",
      label: "Customers",
      icon: Users,
    },
    {
      href: "/dashboard/sales/leads#create-lead",
      label: "Create Lead",
      icon: PlusCircle,
    },
  ]
}

function BrandBlock() {
  return (
    <div className="flex h-16 items-center gap-2 border-b px-5">
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Building2 className="size-5" />
      </span>
      <div>
        <p className="text-sm font-semibold leading-none">Lead Estate</p>
        <p className="mt-1 text-xs text-muted-foreground">CRM</p>
      </div>
    </div>
  )
}

function UserSummary({ user }: { user: AuthUser }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
        {user.role === "ADMIN" ? (
          <Shield className="size-4" />
        ) : (
          <UserRound className="size-4" />
        )}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
      </div>
    </div>
  )
}

function DashboardNavLink({
  item,
  isActive,
  onNavigate,
}: {
  item: DashboardNavItem
  isActive: boolean
  onNavigate?: () => void
}) {
  const Icon = item.icon

  return (
    <Button
      asChild
      variant="ghost"
      className={cn(
        "w-full justify-start gap-2 text-muted-foreground",
        "hover:bg-muted hover:text-foreground",
        isActive &&
          "bg-muted text-foreground shadow-xs ring-1 ring-border hover:bg-muted"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <Link href={item.href} onClick={onNavigate}>
        <Icon className="size-4" />
        <span>{item.label}</span>
      </Link>
    </Button>
  )
}

function isNavItemActive(
  href: string,
  pathname: string,
  dashboardHref: string
) {
  const isCreateLead = href.includes("#create-lead")
  const hasHash = href.includes("#")
  const itemPath = href.split(/[?#]/)[0]

  if (isCreateLead || hasHash) {
    return false
  }

  return (
    pathname === itemPath ||
    (itemPath !== dashboardHref && pathname.startsWith(itemPath))
  )
}

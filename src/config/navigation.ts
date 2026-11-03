import {
  Banknote,
  Briefcase,
  FolderKanban,
  Globe,
  IdCard,
  History,
  Landmark,
  LayoutDashboard,
  ListTodo,
  Newspaper,
  PieChart,
  Receipt,
  Settings,
  SlidersHorizontal,
  Tags,
  TrendingUp,
  UserRoundCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/config/permissions";
import type { MessageKey } from "@/i18n";

export interface NavLink {
  kind: "link";
  href: string;
  labelKey: MessageKey;
  descriptionKey: MessageKey;
  icon: LucideIcon;
  permission: Permission;
  phase: 1 | 2 | 3 | 4 | 5;
}

export interface NavGroup {
  kind: "group";
  id: string;
  labelKey: MessageKey;
  icon: LucideIcon;
  children: NavLink[];
}

export type NavEntry = NavLink | NavGroup;

export const navigation: NavEntry[] = [
  {
    kind: "link",
    href: "/dashboard",
    labelKey: "nav.dashboard",
    descriptionKey: "dashboard.intro",
    icon: LayoutDashboard,
    permission: "dashboard.view",
    phase: 1,
  },
  {
    kind: "group",
    id: "financial",
    labelKey: "nav.financial",
    icon: Wallet,
    children: [
      {
        kind: "link",
        href: "/finance/expenses",
        labelKey: "nav.expenses",
        descriptionKey: "modules.expenses",
        icon: Receipt,
        permission: "finance.view",
        phase: 1,
      },
      {
        kind: "link",
        href: "/finance/revenue",
        labelKey: "nav.revenue",
        descriptionKey: "modules.revenue",
        icon: TrendingUp,
        permission: "finance.view",
        phase: 1,
      },
      {
        kind: "link",
        href: "/finance/payroll",
        labelKey: "nav.payroll",
        descriptionKey: "modules.payroll",
        icon: Banknote,
        permission: "finance.view",
        phase: 1,
      },
      {
        kind: "link",
        href: "/finance/accounts",
        labelKey: "nav.accounts",
        descriptionKey: "modules.accounts",
        icon: Landmark,
        permission: "finance.view",
        phase: 1,
      },
      {
        kind: "link",
        href: "/finance/reports",
        labelKey: "nav.reports",
        descriptionKey: "modules.reports",
        icon: PieChart,
        permission: "finance.view",
        phase: 1,
      },
    ],
  },
  {
    kind: "group",
    id: "operations",
    labelKey: "nav.operations",
    icon: Briefcase,
    children: [
      {
        kind: "link",
        href: "/operations/projects",
        labelKey: "nav.projects",
        descriptionKey: "modules.projects",
        icon: FolderKanban,
        permission: "operations.view",
        phase: 1,
      },
      {
        kind: "link",
        href: "/operations/clients",
        labelKey: "nav.clients",
        descriptionKey: "modules.clients",
        icon: Users,
        permission: "operations.view",
        phase: 1,
      },
      {
        kind: "link",
        href: "/operations/employees",
        labelKey: "nav.employees",
        descriptionKey: "modules.employees",
        icon: IdCard,
        permission: "operations.view",
        phase: 1,
      },
      {
        kind: "link",
        href: "/operations/tasks",
        labelKey: "nav.tasks",
        descriptionKey: "modules.tasks",
        icon: ListTodo,
        permission: "tasks.view",
        phase: 1,
      },
    ],
  },
  {
    kind: "group",
    id: "website",
    labelKey: "nav.website",
    icon: Globe,
    children: [
      {
        kind: "link",
        href: "/website/articles",
        labelKey: "nav.articles",
        descriptionKey: "modules.articles",
        icon: Newspaper,
        permission: "articles.view",
        phase: 1,
      },
    ],
  },
  {
    kind: "group",
    id: "settings",
    labelKey: "nav.settings",
    icon: Settings,
    children: [
      {
        kind: "link",
        href: "/settings",
        labelKey: "nav.preferences",
        descriptionKey: "settings.preferences",
        icon: SlidersHorizontal,
        permission: "settings.view",
        phase: 1,
      },
      {
        kind: "link",
        href: "/settings/categories",
        labelKey: "nav.categories",
        descriptionKey: "categories.expense",
        icon: Tags,
        permission: "settings.manage",
        phase: 1,
      },
      {
        kind: "link",
        href: "/settings/users",
        labelKey: "nav.users",
        descriptionKey: "users.add",
        icon: UserRoundCog,
        permission: "settings.manage",
        phase: 1,
      },
      {
        kind: "link",
        href: "/settings/activity",
        labelKey: "nav.activity",
        descriptionKey: "activity.action",
        icon: History,
        permission: "settings.manage",
        phase: 1,
      },
    ],
  },
];

export function visibleNavigation(canAccess: (permission: Permission) => boolean): NavEntry[] {
  return navigation.flatMap((entry): NavEntry[] => {
    if (entry.kind === "link") {
      return canAccess(entry.permission) ? [entry] : [];
    }
    const children = entry.children.filter((child) => canAccess(child.permission));
    if (children.length === 0) return [];
    const group: NavGroup = { ...entry, children };
    return [group];
  });
}

export function flattenLinks(entries: NavEntry[]): NavLink[] {
  return entries.flatMap((entry) => (entry.kind === "link" ? [entry] : entry.children));
}

export function findPage(pathname: string): { current: NavLink | null; crumbs: NavLink[] } {
  for (const entry of navigation) {
    if (entry.kind === "link" && matchesPath(pathname, entry.href)) {
      return { current: entry, crumbs: [entry] };
    }
    if (entry.kind === "group") {
      const child = entry.children.find((item) => matchesPath(pathname, item.href));
      if (child) {
        return { current: child, crumbs: [child] };
      }
    }
  }
  return { current: null, crumbs: [] };
}

export function pathIsActive(pathname: string, href: string): boolean {
  if (href === "/dashboard" || href === "/settings") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function matchesPath(pathname: string, href: string): boolean {
  return pathIsActive(pathname, href);
}

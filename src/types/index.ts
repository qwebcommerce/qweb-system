export type Role = "administrator" | "manager" | "staff";

export type Locale = "en" | "ar";

export type DateFormat = "dd/MM/yyyy" | "yyyy-MM-dd" | "MM/dd/yyyy";

export type PaymentMethod = "cash" | "cheque" | "card" | "bank_transfer";

export type ExpenseStatus = "paid" | "pending" | "overdue" | "cancelled";

export type RecurringFrequency = "daily" | "monthly" | "yearly" | "one_time";

export type ScheduleFrequency = Exclude<RecurringFrequency, "one_time">;

export type EmployeeType = "staff" | "worker" | "freelancer" | "contractor";

export type WorkingStatus = "office" | "remote" | "inactive";

export type ClientStatus = "active" | "inactive" | "potential" | "archived";

export type ProjectStatus =
  | "pending"
  | "in_progress"
  | "on_hold"
  | "completed"
  | "cancelled";

export type ContractType = "monthly" | "one_time" | "special";

export type TaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "on_hold"
  | "cancelled";

export type ArticleStatus = "draft" | "published" | "archived";

export type AccountType = "cash" | "bank";

export type AccountStatus = "active" | "inactive";

export type AccountTransactionType =
  | "receipt"
  | "payment"
  | "transfer_in"
  | "transfer_out"
  | "adjustment";

export type MoneyDirection = "in" | "out";

export type FinancialSourceType =
  | "revenue"
  | "expense"
  | "payroll"
  | "transfer"
  | "adjustment";

export type PayrollStatus = "draft" | "pending" | "paid" | "cancelled";

export type ChequeClearanceStatus = "pending" | "cleared" | "bounced" | "cancelled";

export interface LocalizedText {
  en: string;
  ar: string;
}

export interface AuditFields {
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface SessionUser {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  employeeId: string | null;
}

export interface UserProfile extends AuditFields {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  active: boolean;
  employeeId: string | null;
  photoURL: string | null;
}

export interface CompanySettings {
  name: string;
  logoUrl: string | null;
  email: string;
  phone: string;
  address: string;
  currency: string;
  info: string;
  defaultLanguage: Locale;
  dateFormat: DateFormat;
  updatedAt: string | null;
}

export interface Category extends AuditFields {
  id: string;
  name: LocalizedText;
  active: boolean;
  sortOrder: number;
  /** Stable key for categories the system depends on, such as salary. */
  systemKey: string | null;
}

export interface Employee extends AuditFields {
  id: string;
  code: string;
  fullName: string;
  email: string;
  mobile: string;
  position: string;
  type: EmployeeType;
  startDate: string;
  basicSalary: number;
  hourlyCost: number;
  workingStatus: WorkingStatus;
  notes: string;
  photoURL: string | null;
  active: boolean;
}

export interface Client extends AuditFields {
  id: string;
  code: string;
  name: string;
  companyName: string;
  contactPerson: string;
  mobile: string;
  email: string;
  status: ClientStatus;
  notes: string;
}

export interface Project extends AuditFields {
  id: string;
  code: string;
  title: string;
  clientId: string;
  clientName: string;
  typeId: string;
  contractValue: number;
  startDate: string;
  plannedDeliveryDate: string;
  actualDeliveryDate: string | null;
  status: ProjectStatus;
  contractType: ContractType;
  /** Sum of received revenue linked to this project. */
  collectedAmount: number;
  /** Contract value minus collected amount. */
  contractBalance: number;
  /** Direct project expenses only. Payroll is excluded. */
  totalExpenses: number;
  /** Internal allocation of hours. Not a cash expense. */
  laborCost: number;
  /** Contract value minus direct expenses minus labor. */
  netProfit: number;
  notes: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  employeeId: string;
  role: string;
  assignedAt: string;
}

export interface LaborAllocation extends AuditFields {
  id: string;
  projectId: string;
  employeeId: string;
  date: string;
  hours: number;
  hourlyCost: number;
  totalCost: number;
  description: string;
  notes: string;
}

export interface LineAmount {
  id: string;
  title: string;
  amount: number;
  notes: string;
}

export interface Expense extends AuditFields {
  id: string;
  code: string;
  categoryId: string;
  title: string;
  amount: number;
  frequency: RecurringFrequency;
  dueDate: string;
  expenseDate: string | null;
  isRecurringOccurrence: boolean;
  recurringExpenseId: string | null;
  /** scheduleId + due date. Prevents duplicate occurrences. */
  occurrenceKey: string | null;
  status: ExpenseStatus;
  paymentMethod: PaymentMethod | null;
  clientId: string | null;
  projectId: string | null;
  notes: string;
  paidAt: string | null;
  accountId: string | null;
  accountTransactionId: string | null;
  sourceType: "manual" | "payroll" | "recurring";
  sourceId: string | null;
  /** False for payroll, so salary is not also a project cost. */
  countsAsProjectExpense: boolean;
}

export interface RecurringExpense extends AuditFields {
  id: string;
  code: string;
  categoryId: string;
  title: string;
  amount: number;
  frequency: ScheduleFrequency;
  startDate: string;
  /** Day of month to preserve, including month-end dates. */
  anchorDay: number;
  nextDueDate: string;
  endDate: string | null;
  active: boolean;
  clientId: string | null;
  projectId: string | null;
  defaultPaymentMethod: PaymentMethod | null;
  notes: string;
}

export interface Revenue extends AuditFields {
  id: string;
  code: string;
  date: string;
  clientId: string;
  projectId: string | null;
  categoryId: string;
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
  notes: string;
  accountId: string | null;
  accountTransactionId: string | null;
  status: "received" | "cancelled";
}

export interface Payroll extends AuditFields {
  id: string;
  code: string;
  employeeId: string;
  employeeName: string;
  month: string;
  basicSalary: number;
  bonuses: LineAmount[];
  deductions: LineAmount[];
  adjustments: LineAmount[];
  totalPayable: number;
  status: PayrollStatus;
  paymentDate: string | null;
  paymentMethod: PaymentMethod | null;
  expenseId: string | null;
  accountId: string | null;
  accountTransactionId: string | null;
  notes: string;
}

export interface Task extends AuditFields {
  id: string;
  code: string;
  clientId: string;
  projectId: string | null;
  description: string;
  taskDate: string;
  givenById: string;
  assignedToId: string | null;
  status: TaskStatus;
  staffNotes: string;
}

export interface ArticleContent {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  seoTitle: string;
  metaDescription: string;
}

export interface Article extends AuditFields {
  id: string;
  featuredImageUrl: string | null;
  categoryId: string;
  authorId: string;
  status: ArticleStatus;
  publishDate: string | null;
  en: ArticleContent;
  ar: ArticleContent;
}

export interface ChequeDetails {
  number: string;
  bankName: string;
  date: string;
  clearanceStatus: ChequeClearanceStatus;
}

export interface CashAccount extends AuditFields {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  bankName: string | null;
  /** Last four digits only. The full number is never stored. */
  accountNumberLast4: string | null;
  openingBalance: number;
  currentBalance: number;
  currency: string;
  status: AccountStatus;
  notes: string;
}

export interface AccountTransaction extends AuditFields {
  id: string;
  code: string;
  accountId: string;
  type: AccountTransactionType;
  amount: number;
  direction: MoneyDirection;
  date: string;
  paymentMethod: PaymentMethod | null;
  sourceType: FinancialSourceType;
  sourceId: string;
  transferGroupId: string | null;
  idempotencyKey: string;
  description: string;
  notes: string;
  cheque: ChequeDetails | null;
  status: "posted" | "reversed";
  reversalOf: string | null;
}

export type ActivityModule =
  | "expenses"
  | "revenue"
  | "payroll"
  | "employees"
  | "projects"
  | "clients"
  | "tasks"
  | "articles"
  | "users"
  | "settings"
  | "accounts";

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  module: ActivityModule;
  recordId: string;
  description: string;
  previousValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  module: string;
  recordId: string;
  dedupeKey: string;
  read: boolean;
  dismissed: boolean;
  createdAt: string;
}

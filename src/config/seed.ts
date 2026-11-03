import type { LocalizedText } from "@/types";

export interface SeedCategory {
  id: string;
  name: LocalizedText;
  systemKey: string | null;
  sortOrder: number;
}

export const expenseCategorySeeds: SeedCategory[] = [
  { id: "salary", name: { en: "Salary", ar: "الرواتب" }, systemKey: "salary", sortOrder: 10 },
  { id: "rent", name: { en: "Office Rent", ar: "إيجار المكتب" }, systemKey: null, sortOrder: 20 },
  { id: "internet", name: { en: "Internet", ar: "الإنترنت" }, systemKey: null, sortOrder: 30 },
  {
    id: "software",
    name: { en: "Software Subscriptions", ar: "اشتراكات البرمجيات" },
    systemKey: null,
    sortOrder: 40,
  },
  { id: "marketing", name: { en: "Marketing", ar: "التسويق" }, systemKey: null, sortOrder: 50 },
  {
    id: "transportation",
    name: { en: "Transportation", ar: "المواصلات" },
    systemKey: null,
    sortOrder: 60,
  },
  {
    id: "project",
    name: { en: "Project Expenses", ar: "مصروفات المشاريع" },
    systemKey: "project",
    sortOrder: 70,
  },
  { id: "equipment", name: { en: "Equipment", ar: "المعدات" }, systemKey: null, sortOrder: 80 },
  { id: "other", name: { en: "Other", ar: "أخرى" }, systemKey: "other", sortOrder: 90 },
];

export const revenueCategorySeeds: SeedCategory[] = [
  {
    id: "project-payment",
    name: { en: "Project Payment", ar: "دفعة مشروع" },
    systemKey: null,
    sortOrder: 10,
  },
  {
    id: "monthly-contract",
    name: { en: "Monthly Contract", ar: "عقد شهري" },
    systemKey: null,
    sortOrder: 20,
  },
  { id: "maintenance", name: { en: "Maintenance", ar: "الصيانة" }, systemKey: null, sortOrder: 30 },
  {
    id: "website",
    name: { en: "Website Development", ar: "تطوير المواقع" },
    systemKey: null,
    sortOrder: 40,
  },
  {
    id: "mobile",
    name: { en: "Mobile Application", ar: "تطبيقات الجوال" },
    systemKey: null,
    sortOrder: 50,
  },
  {
    id: "consultation",
    name: { en: "Consultation", ar: "الاستشارات" },
    systemKey: null,
    sortOrder: 60,
  },
  { id: "other", name: { en: "Other", ar: "أخرى" }, systemKey: null, sortOrder: 70 },
];

export const projectTypeSeeds: SeedCategory[] = [
  { id: "website", name: { en: "Website", ar: "موقع إلكتروني" }, systemKey: null, sortOrder: 10 },
  { id: "mobile", name: { en: "Mobile Application", ar: "تطبيق جوال" }, systemKey: null, sortOrder: 20 },
  { id: "maintenance", name: { en: "Maintenance", ar: "صيانة" }, systemKey: null, sortOrder: 30 },
  { id: "consultation", name: { en: "Consultation", ar: "استشارة" }, systemKey: null, sortOrder: 40 },
  { id: "other", name: { en: "Other", ar: "أخرى" }, systemKey: null, sortOrder: 50 },
];

export const articleCategorySeeds: SeedCategory[] = [
  { id: "news", name: { en: "News", ar: "الأخبار" }, systemKey: null, sortOrder: 10 },
  { id: "insights", name: { en: "Insights", ar: "رؤى" }, systemKey: null, sortOrder: 20 },
  {
    id: "announcements",
    name: { en: "Announcements", ar: "الإعلانات" },
    systemKey: null,
    sortOrder: 30,
  },
];

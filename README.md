# Qweb

Private company management system for finances, projects, clients, employees, tasks, payroll, and website articles. It is an internal tool. There is no public registration.

The application shell, sign-in, and the operating modules are in place: clients, employees, projects, tasks, expenses, revenue, payroll, accounts, the live dashboard, reports, articles, categories, users, activity, and notifications. Records come from Firestore. There is no sample financial data.

## Stack

Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Firebase Authentication, and Cloud Firestore. Money math lives in `src/lib/financial` and is covered by tests.

## Setup

1. Create a Firebase project.
2. Enable Authentication with the Email/Password provider.
3. Create a Cloud Firestore database.
4. In Project settings, create a web app and copy its client configuration.
5. In Project settings, open Service accounts and generate a new private key. Paste that JSON file, as one line inside single quotes, into `FIREBASE_ADMIN_CONFIG`.
6. Copy the environment template and fill it in:

```bash
cp .env.example .env.local
```

Keep `FIREBASE_ADMIN_CONFIG` and `SETUP_SECRET` on the server only. Do not prefix the service account value with `NEXT_PUBLIC_`.

7. Install and start the app:

```bash
npm install
npm run dev
```

8. Open `/setup`, enter `SETUP_SECRET`, and create the first administrator. This can be done once. After that, sign in at `/login`.
9. Deploy the rules and indexes when the Firebase CLI is logged in to the same project:

```bash
npx firebase-tools deploy --only firestore:rules,firestore:indexes
```

The Admin SDK bypasses security rules, so the rules still need to be deployed. They are what stop a signed-in browser from reading another role's data.

## Access

| Role | Access |
| --- | --- |
| Administrator | Every module, users, and settings |
| Manager | Operations and finance. No user administration |
| Staff | Assigned tasks and personal display preferences |

Someone who creates a Firebase Authentication user directly still cannot sign in here. A session is issued only when the account has an active profile and a matching role claim, both created by an administrator.

## How money is counted

Each figure has one source:

- Company revenue is the sum of received revenue records.
- Company expenses are the sum of paid expense records. A recurring schedule is not an expense. Each generated due date is its own expense, keyed by schedule and date.
- Paying payroll creates one salary expense and one account payment. The payroll row stores those ids. Company totals do not add the payroll amount again.
- Labor allocations change project profit only. They do not create a cash expense.
- Account balances change only when a payment, receipt, transfer, or adjustment is posted. Pending items do not move cash.
- A transfer updates two accounts and is excluded from revenue and expenses.
- Project contract balance is contract value minus collected revenue. Project profit is contract value minus direct project expenses minus allocated labor. Payroll is not also treated as a project expense.

Posted financial records are cancelled with a reversal rather than erased. The helpers in `src/lib/financial/calculations.ts` are the reference for these rules, and `npm test` checks them.

## Languages and currency

The interface is English and Arabic. Arabic uses a right-to-left layout. The choice is stored in the browser and survives refresh. Amounts are stored as numbers. The default currency is QAR, and the company profile can store a different ISO code later. Dates and amounts keep Western digits so columns stay aligned.

## Scripts

```bash
npm run dev
npm test
npm run lint
npm run build
```

## Operating notes

- Company profit on the dashboard is received revenue minus paid expenses for the selected period.
- A recurring schedule is not cash. Use “Generate due expenses” to create one expense per due date.
- Paying payroll creates one salary expense. Project profit does not add that salary again.
- Project screens include linked expenses that are not cancelled, including pending ones, so committed cost is visible. The dashboard does not.
- Labor hours change project profit only.
- Transfers move money between accounts and are excluded from revenue and expenses.
- Posted payments are cancelled with a reversal. Account numbers are stored as the last four digits.
- Notifications are calculated when the bell opens. Dismissing one hides that item for the current user.
- Deploy rules and indexes after pulling these changes, or filtered lists will fail until the composite indexes exist.

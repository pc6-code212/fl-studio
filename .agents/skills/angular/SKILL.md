\---

name: angular-project-structure

description: Production-grade, scalable Domain-Driven and Feature-Based architecture for modern Angular (v18+ standalone-first, signal-ready) applications.

\---



\# Angular Project Architecture



A scalable \*\*Domain-Driven / Feature-Based Architecture\*\* designed for modern Angular (v18+ standalone-first, signal-ready). It prevents circular or tangled imports, isolates business domains, and scales cleanly from small apps to enterprise systems.



\## Directory Tree



```text

src/

├── app/

│   ├── core/                         # Singleton services, global config, app-wide guards/interceptors

│   │   ├── auth/                     # Authentication state, token storage, auth service

│   │   ├── config/                   # App config tokens, environment adapters

│   │   ├── error-handling/           # Global ErrorHandler, HTTP error mapper

│   │   ├── guards/                   # Route guards (authGuard, roleGuard, unsavedChangesGuard)

│   │   ├── interceptors/             # Functional HTTP interceptors (auth, retry, loading, logging)

│   │   └── services/                 # Singletons (StorageService, ThemeService, LoggerService)

│   │

│   ├── shared/                       # Dumb/reusable UI, pipes, directives, utils (NO business logic)

│   │   ├── components/               # Reusable UI primitives (button, modal, data-table, spinner)

│   │   ├── directives/               # Custom attribute/structural directives (clickOutside, debounceClick)

│   │   ├── pipes/                    # Pure formatting pipes (truncate, timeAgo, safeHtml)

│   │   ├── models/                   # Shared generic interfaces (ApiResponse<T>, PaginatedList<T>)

│   │   └── utils/                    # Pure helper functions (date-helpers, form-validators, array-utils)

│   │

│   ├── layout/                       # App shells \& structural frames

│   │   ├── main-layout/              # Authenticated shell (sidebar, topbar, router-outlet, footer)

│   │   ├── auth-layout/              # Minimalist shell for login/register/reset-password

│   │   └── components/               # Layout-specific parts (navbar, sidebar, breadcrumbs)

│   │

│   ├── features/                     # Isolated business domains (lazy-loaded)

│   │   ├── auth/

│   │   │   ├── pages/                # Routed smart components (login.page.ts, register.page.ts)

│   │   │   ├── components/           # Feature-specific UI (login-form.component.ts)

│   │   │   └── auth.routes.ts

│   │   │

│   │   ├── dashboard/

│   │   │   ├── components/           # KPI widgets, charts

│   │   │   ├── pages/                # dashboard-overview.page.ts

│   │   │   ├── services/             # Feature-scoped state/facades (dashboard.store.ts)

│   │   │   └── dashboard.routes.ts

│   │   │

│   │   └── users/                    # Example complete domain feature

│   │       ├── components/           # Presentational components (user-card, user-filter-bar)

│   │       ├── pages/                # Routed smart containers (user-list.page, user-detail.page)

│   │       ├── services/             # API + State (user-api.service.ts, user.store.ts)

│   │       ├── models/               # Domain types \& DTOs (user.model.ts, user-dto.model.ts)

│   │       ├── mappers/              # DTO <-> Domain Model transformers

│   │       └── users.routes.ts       # Lazy-loaded feature routes

│   │

│   ├── app.component.ts              # Root component (minimal, just <router-outlet />)

│   ├── app.config.ts                 # ApplicationConfig (providers, router, httpClient, interceptors)

│   └── app.routes.ts                 # Top-level lazy route definitions

│

├── assets/                           # Static files (icons, images, i18n JSONs)

├── styles/                           # Global SCSS architecture

│   ├── abstracts/                    # Variables, mixins, functions (no CSS output)

│   ├── base/                         # Reset, typography, utility classes

│   ├── themes/                       # CSS custom properties (light/dark mode tokens)

│   └── styles.scss                   # Main entry point importing the above

│

└── environments/                     # environment.ts, environment.prod.ts

```



\---



\## Architectural Rules



| Layer | Responsibility | Strict Dependency Rule |

| :--- | :--- | :--- |

| \*\*`core/`\*\* | App-wide singletons (`providedIn: 'root'`), HTTP plumbing, auth, global error handling. | Can only import from `shared/` or external libraries. \*\*Never\*\* imports from `features/`. |

| \*\*`shared/`\*\* | Stateless, reusable UI components, pipes, directives, and pure utility functions. | \*\*Zero\*\* dependencies on `core/` or `features/`. Must work independently anywhere. |

| \*\*`layout/`\*\* | Structural wrappers (sidebars, headers, shells) that host routed views. | Can import from `core/` and `shared/`. \*\*Never\*\* imports from `features/`. |

| \*\*`features/`\*\* | Vertical slices of business logic (pages, domain services, signal stores, DTO mappers). | Can import from `core/` and `shared/`. \*\*Never\*\* import directly from another `feature/` (use routing or shared events/state instead). |



\---



\## Key Implementation Patterns



\### 1. Smart (`pages/`) vs. Dumb (`components/`) Separation

\* \*\*`pages/`\*\*: Routed containers that inject stores/services, handle route params, and pass data down via `input()`.

\* \*\*`components/`\*\*: Pure presentational components using `input()` and `output()` with `ChangeDetectionStrategy.OnPush`.



\### 2. DTOs + Mappers (`models/` \& `mappers/`)

\* Never bind raw backend JSON directly to templates.

\* Map backend DTOs (`snake\_case`) into clean frontend domain models (`camelCase`) inside `mappers/` so backend API changes do not break your UI.



\### 3. Path Aliases (`tsconfig.json`)

Configure clean imports to avoid deep relative paths (`../../../../shared/...`):



```json

{

&#x20; "compilerOptions": {

&#x20;   "paths": {

&#x20;     "@core/\*": \["src/app/core/\*"],

&#x20;     "@shared/\*": \["src/app/shared/\*"],

&#x20;     "@layout/\*": \["src/app/layout/\*"],

&#x20;     "@features/\*": \["src/app/features/\*"],

&#x20;     "@env/\*": \["src/environments/\*"]

&#x20;   }

&#x20; }

}

```



\### 4. Enforce Module Boundaries Automatically

Use ESLint (`@nx/enforce-module-boundaries` or `eslint-plugin-boundaries`) to throw build errors if someone accidentally imports a file from one feature (e.g., `features/orders`) inside another feature (`features/users`).


# UI architecture

## Structure

- `src/app/layout.tsx`: html shell, global styles, toast host.
- `src/app/(app)/layout.tsx`: wraps every section in `AppShell`. Pages never rebuild the chrome.
- `src/components/layout`: `AppShell` (sidebar, mobile drawer, skip link), `Sidebar`, `PageHeader`, `Breadcrumbs`, `FutureFeature`.
- `src/components/ui`: `Button`, `Input`/`Textarea`/`Select`/`Field`, `Badge`, `Card`, `Table`, `Dialog`/`ConfirmDialog`, `Alert`/`Spinner`/`Skeleton`/`EmptyState`/`ErrorState`, `IntegrationStatusBadge`, `Toaster`.
- `src/components/projects`, `src/components/integration-card.tsx`: feature components. They call `/api` through `src/lib/api.ts`, never ElevenLabs.
- `src/lib/navigation.ts`: the single list of sections. A `plannedPhase` marks future sections.

## Server and client split

Pages are server components that call services directly, so first paint shows real data. Only interactive pieces are client components: forms, dialogs, the mobile menu, the connection check.

## Design tokens

All colours are CSS variables in `globals.css` and surface through `tailwind.config.ts`. Light theme, cool neutral background, one deep cyan accent, semantic success, warning and danger pairs. System font stack (no network font fetch). Radius is 6px for controls and 8px for containers. Changing a token changes the whole app.

## States

| State | Implementation |
| --- | --- |
| Loading | `(app)/loading.tsx` skeleton; buttons show `aria-busy` spinners |
| Empty | `EmptyState` with a working action, separate copy for filtered results |
| Error | `ErrorState` with sanitized text; `(app)/error.tsx` never prints the exception |
| Unavailable metric | Labelled "Not available yet" with the phase that enables it |
| Future section | `FutureFeature`: no data, no operational controls, links back to Projects and Dashboard |

## Accessibility

Skip link, `aria-current` on navigation, labelled form fields with `aria-describedby` for hints and errors, `role="alert"` for errors, `aria-live` for the connection check result, Radix dialogs (focus trap, Escape), visible `:focus-visible` ring, reduced-motion respected. Mobile menu is a modal dialog closable with Escape. Not yet audited with a screen reader or an automated tool such as axe.

## Conventions for new phases

Add the page under `src/app/(app)/<section>`, reuse `PageHeader` and the `ui` components, add any new colour as a token, and add the migration, service and API route before the UI.

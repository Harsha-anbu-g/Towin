# 5. C4 context — the big picture (people, systems, services)

**Syntax you learn here:** `C4Context`, `Person()`, `System()`, `SystemDb()`,
`System_Ext()` for third-party services, `System_Boundary` to group what you own,
and `Rel(from, to, "what", "how")`.

This is the real deploy: frontend on Vercel, backend on Railway.

```mermaid
C4Context
    title ToWin — system context

    Person(elder, "Elder", "Posts needs, builds trusted connections")
    Person(helper, "Helper", "Finds elders nearby, offers help")

    System_Boundary(towin, "ToWin") {
        System(fe, "React frontend", "Vite + React 19, hosted on Vercel")
        System(be, "Spring Boot API", "Java 21, 16 feature slices, hosted on Railway")
        SystemDb(db, "PostgreSQL", "users, needs, connections, messages, trust")
    }

    System_Ext(google, "Google OAuth", "sign in with Google")
    System_Ext(s3, "AWS S3", "profile photo uploads")
    System_Ext(brevo, "Brevo", "verification emails")
    System_Ext(nominatim, "Nominatim (OSM)", "address search / geocoding")
    System_Ext(posthog, "PostHog", "product analytics")

    Rel(elder, fe, "uses", "browser")
    Rel(helper, fe, "uses", "browser")
    Rel(fe, be, "REST + Bearer JWT", "HTTPS /api/**")
    Rel(be, db, "reads/writes", "JPA + Flyway")
    Rel(be, google, "token exchange", "OAuth 2.0")
    Rel(be, s3, "stores photos", "AWS SDK")
    Rel(be, brevo, "sends emails", "HTTPS API")
    Rel(be, nominatim, "geocodes addresses", "HTTPS")
    Rel(fe, posthog, "sends events", "posthog-js")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

**Read it as:** two kinds of people use one frontend; the frontend only ever
talks to your API; the API owns the database and delegates specialties
(login, photos, email, maps, analytics) to outside services.

**Try changing:** add `System_Ext(twilio, "Twilio", "SOS SMS")` and a
`Rel(be, twilio, "sends SOS", "SMS")` — that service exists in the code too.

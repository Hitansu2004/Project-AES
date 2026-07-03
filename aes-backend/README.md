# AES Backend — Arial Engineering Services Customer Portal

Spring Boot 3.3.5 REST + WebSocket backend for the AES service-management platform
(customer app, engineer app, CRM/admin web).

Built and maintained by **Arial Engineering Services** for **Arial Engineering / AES**.

---

## Tech Stack

| Layer               | Technology                                     |
| ------------------- | ---------------------------------------------- |
| Language            | Java 21 (LTS)                                  |
| Framework           | Spring Boot 3.3.5                              |
| Build tool          | Maven 3.9+                                     |
| Database            | PostgreSQL 15+                                 |
| Cache / queue       | Redis 7 (via Spring Data Redis)                |
| Migrations          | Flyway 10                                      |
| Auth                | JWT (access + refresh) + OTP + Google OAuth    |
| Mapping             | MapStruct 1.6                                  |
| Boilerplate         | Lombok                                         |
| API docs            | SpringDoc OpenAPI 2.x (Swagger UI)             |
| Realtime            | STOMP over WebSocket (SockJS fallback)         |
| SMS                 | Twilio / MSG91 (pluggable)                     |
| Payments            | Razorpay (webhook + order API)                 |
| Maps                | Google Maps Platform (Geocoding + Directions)  |

---

## Prerequisites

- JDK 21
- Maven 3.9+
- PostgreSQL 15+ running on `localhost:5432` (or set `spring.datasource.url`)
- Redis 7 running on `localhost:6379`

Create the local database once:

```sql
CREATE DATABASE aes_db;
CREATE USER aes_user WITH ENCRYPTED PASSWORD 'aes_pass';
GRANT ALL PRIVILEGES ON DATABASE aes_db TO aes_user;
```

---

## Environment variables

The application reads all secrets from environment variables. Set these before
running in **prod**:

| Variable                  | Purpose                                              |
| ------------------------- | ---------------------------------------------------- |
| `SPRING_PROFILES_ACTIVE`  | `dev` or `prod` (defaults to `dev`)                  |
| `JWT_SECRET`              | 256-bit secret for JWT signing                       |
| `TWILIO_ACCOUNT_SID`      | Twilio SID (leave blank for demo)                    |
| `TWILIO_AUTH_TOKEN`       | Twilio auth token                                    |
| `TWILIO_FROM_NUMBER`      | Sender phone number                                  |
| `GOOGLE_MAPS_BACKEND_KEY` | Server-side Google Maps API key                      |
| `AES_OFFICE_LAT`          | HQ latitude (default 17.4156 — Banjara Hills)        |
| `AES_OFFICE_LNG`          | HQ longitude (default 78.4347)                       |
| `AES_OFFICE_ADDRESS`      | Human-readable HQ address                            |
| `CORS_ALLOWED_ORIGINS`    | Comma-separated origins for the browser SPA          |

For local development, `application-dev.properties` enables demo mode so OTPs
are returned in the API response and the universal `000000` bypass code works.

### Local secrets file (never committed)

Instead of exporting env vars every time, you can put your real API keys in
a **local-only** properties file at the project root:

```
aes-backend/application-secrets.properties      ← git-ignored
```

`application.properties` auto-loads it via:

```properties
spring.config.import=optional:file:./application-secrets.properties
```

Example contents:

```properties
app.google.maps-key=AIza...your-real-key...
jwt.secret=your-local-256-bit-jwt-secret-here
twilio.account-sid=AC...
twilio.auth-token=...
razorpay.key-id=rzp_test_...
razorpay.key-secret=...
```

The `optional:` prefix means the app boots fine on CI / staging / prod
machines that don't have this file — those environments should use real
env vars or an external secret manager instead.

---

## Running locally

```bash
# 1. Build
./mvnw clean package -DskipTests

# 2. Run (uses application-dev.properties)
./mvnw spring-boot:run

# or run the packaged jar
java -jar target/aes-backend-1.0.0.jar
```

The API is served on `http://localhost:8080`.

Swagger UI: `http://localhost:8080/swagger-ui.html`

---

## Project layout

```
aes-backend/
├── pom.xml
├── src/
│   ├── main/
│   │   ├── java/com/aes/             # Application code
│   │   └── resources/
│   │       ├── application.properties        # common config
│   │       ├── application-dev.properties    # dev overrides
│   │       ├── application-prod.properties   # prod overrides
│   │       ├── logback-spring.xml            # log config
│   │       └── db/migration/                 # Flyway SQL
│   └── test/
└── README.md
```

---

## Branch / release policy

- `main` — always deployable; protected branch.
- Feature branches: `feature/<sprint>-<slug>` (e.g. `feature/s2-amc-module`).
- PRs require passing build and at least one review before merge.
- Sprint tags: `sprint-<n>-<yyyy-mm-dd>`.

---

## License

Proprietary — © Arial Engineering / AES. All rights reserved.

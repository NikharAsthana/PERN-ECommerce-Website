# 🛍️ NeoBuy

A full-stack e-commerce app with authentication, payments, order chat, video calls, an admin dashboard, and error monitoring.

**🔗 Live demo:** [https://neobuy.onrender.com](https://neobuy.onrender.com)

> ⚠️ Hosted on Render's free tier, so the first request after a period of inactivity may take a few seconds. In production, a cron job runs to keep the service active.

---

## ✨ Features

- **Authentication** with Clerk
- **Product catalog** with a home page, product detail pages, and ImageKit image optimization
- **Cart** with global state and a live item count in the navbar
- **Checkout & payments** through Polar, with a checkout return page and a payment webhook
- **Orders**: order history, plus an order detail page with a summary view
- **Order chat** powered by Stream Chat
- **Video calls** per order, powered by Stream Video
- **Admin dashboard** for managing products, with image uploads to ImageKit
- **Error monitoring** with Sentry on both frontend and backend, with errors tagged by Clerk user ID
- **User sync**: a Clerk webhook (`user.created`, `user.updated`, `user.deleted`) keeps the Neon Postgres `users` table in sync

---

## 🧰 Tech Stack

### Frontend

| Purpose | Tool |
| --- | --- |
| Framework / bundler | React 19 + Vite 8 |
| Styling | Tailwind CSS 4 (`@tailwindcss/vite`) + daisyUI 5 |
| Routing | React Router 8 |
| Server state | TanStack Query 5 (`useQuery` for GETs, `useMutation` for everything else) |
| Client state | Zustand 5 (cart) |
| Auth | Clerk (`@clerk/react`) |
| Chat & video | `stream-chat`, `stream-chat-react`, `@stream-io/video-react-sdk` |
| Monitoring | Sentry (`@sentry/react`) with an error boundary |
| Icons | lucide-react |

### Backend

| Purpose | Tool |
| --- | --- |
| Runtime / framework | Node.js, Express 5, TypeScript |
| Database | PostgreSQL on [Neon](https://neon.tech) via `pg` |
| ORM | Drizzle ORM + drizzle-kit |
| Auth | Clerk (`@clerk/express`, `@clerk/backend`) |
| Payments | Polar |
| Chat & video | Stream (`stream-chat`) |
| Image hosting | ImageKit (`@imagekit/nodejs`) |
| Webhook verification | `standardwebhooks` |
| Validation | Zod (including environment variables) |
| Monitoring | Sentry (`@sentry/node`, `@sentry/profiling-node`) |
| Scheduling | `cron` |
| Dev tooling | `tsx` |

### Deployment

- **Render**, using a Docker image that serves both the API and the frontend

---

## 📁 Project Structure

```
.
├── Backend
│   ├── drizzle.config.ts
│   ├── scripts
│   │   └── seed.ts                  # Seeds the database with sample data
│   └── src
│       ├── index.ts                 # App entry: webhooks, middleware, routes, static frontend
│       ├── instrument.ts            # Sentry initialization (loaded before the app)
│       ├── controllers              # Route handler logic
│       │   ├── adminController.ts
│       │   ├── checkoutController.ts
│       │   ├── orderController.ts
│       │   ├── productController.ts
│       │   └── streamController.ts
│       ├── db
│       │   ├── index.ts             # DB pool + Drizzle instance
│       │   └── schema.ts            # Tables and relations
│       ├── lib                      # Shared helpers
│       │   ├── cron.ts              # Keep-alive job
│       │   ├── env.ts               # Zod env validation (loadEnv / getEnv)
│       │   ├── imagekit.ts
│       │   ├── polar.ts
│       │   ├── roles.ts
│       │   ├── stream.ts
│       │   └── users.ts
│       ├── middleware
│       │   └── sentryClerkUser.ts   # Attaches the Clerk user ID to Sentry errors
│       ├── routes
│       │   ├── adminRouter.ts
│       │   ├── checkoutRouter.ts
│       │   ├── meRouter.ts
│       │   ├── orderRouter.ts
│       │   ├── productRouter.ts
│       │   └── streamRouter.ts
│       └── webhooks
│           ├── clerk.ts
│           └── polar.ts
│
├── Frontend
│   └── src
│       ├── App.jsx                  # Routes
│       ├── main.jsx
│       ├── components               # Navbar, Footer, Layout, cards, forms, skeletons...
│       ├── hooks                    # Custom hooks for page data and logic
│       ├── lib
│       │   ├── api.js               # Authenticated fetch helper
│       │   ├── imageKitUrl.js       # ImageKit URL transforms (sizes / quality)
│       │   └── imagekitUpload.js    # Admin image upload helper
│       ├── pages
│       ├── store
│       │   └── cart.js              # Zustand cart store (useCart)
│       └── utils
│           └── format.js            # Price and date formatting
│
├── Dockerfile
└── .dockerignore
```

---

## 🗄️ Database Schema

Managed with Drizzle ORM on PostgreSQL. Columns use snake_case in the database and camelCase in code. Prices are stored as integer minor units (`priceCents`, which map directly to paise; the default currency is `inr`).

| Table | Key columns | Notes |
| --- | --- | --- |
| `users` | `id` (uuid), `clerk_user_id` (unique), `email`, `display_name`, `role`, timestamps | `role` is `customer` (default), `support`, or `admin` |
| `products` | `id` (uuid), `slug` (unique), `name`, `category`, `description`, `price_cents`, `currency`, `image_url`, `image_kit_file_id`, `active`, `created_at` | `image_kit_file_id` is stored so images can be deleted from ImageKit |
| `checkout_sessions` | `id` (uuid), `user_id`, `polar_checkout_id` (unique), `lines` (JSONB), `total_cents`, `currency`, `created_at` | Record of each checkout. `lines` holds `{ productId, quantity, unitPriceCents }` entries |
| `orders` | `id` (uuid), `user_id`, `status`, `polar_checkout_id`, `polar_order_id` (unique), `total_cents`, timestamps | `status` is `pending` (default), `paid`, or `failed` |
| `order_items` | `id` (uuid), `order_id`, `product_id`, `quantity`, `unit_price_cents` | One row per product line in an order |

**Relations**

- A user has many orders; each order belongs to exactly one user.
- An order has many order items; each order item belongs to one order and one product.
- A product can appear in many order items.

**Deletion behavior:** deleting a user cascades to their orders and checkout sessions, and deleting an order cascades to its items. A product that appears in an order item cannot be deleted (`restrict`).

---

## 🔌 Backend Routes

| Route | Handler |
| --- | --- |
| `GET /health` | Health check |
| `/api/me` | `meRouter`: returns the currently authenticated user, fetched from the database |
| `/api/products` | `productRouter` |
| `/api/stream` | `streamRouter` |
| `/api/checkout` | `checkoutRouter` |
| `/api/admin` | `adminRouter` |
| `/api/orders` | `orderRouter` |
| `POST /webhooks/clerk` | `clerkWebhookHandler`: syncs users into the database |
| `POST /webhooks/polar` | `polarWebhookHandler` |

The two webhook routes are registered **before** `express.json()` and receive the raw request body, because webhook signature verification needs the unparsed payload.

If a `public/` directory exists next to the running server, Express serves it as the frontend and falls back to `index.html` for any non-`/api`, non-`/webhooks` GET request (so client-side routing works).

## 🧭 Frontend Routes

| Path | Page | Requires sign-in |
| --- | --- | --- |
| `/` | Home | No |
| `/cart` | Cart | No |
| `/product/:slug` | Product detail | No |
| `/orders` | Order history | Yes (redirects to `/`) |
| `/orders/:id` | Order detail, summary view | - |
| `/orders/:id/chat` | Order detail, chat view | - |
| `/orders/:id/call` | Order video call | Yes (redirects to `/`) |
| `/checkout/return` | Post-payment return page | No |
| `/admin` | Admin products | Yes (redirects to `/`) |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 22 and npm (the Docker image uses Node 22)
- A [Neon](https://neon.tech) Postgres database
- Accounts for [Clerk](https://clerk.com), [Stream](https://getstream.io), [ImageKit](https://imagekit.io), [Polar](https://polar.sh) (sandbox works), and [Sentry](https://sentry.io)

### 1. Clone the repo

```bash
git clone <your-repo-url>
cd <your-repo-name>
```

### 2. Backend setup

```bash
cd Backend
npm install
cp .env.example .env
```

Fill in `.env`:

| Variable | Description |
| --- | --- |
| `PORT` | Server port (example uses `3001`) |
| `NODE_ENV` | `development` or `production` |
| `DATABASE_URL` | Neon Postgres connection string |
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `CLERK_WEBHOOK_SECRET` | Signing secret for the Clerk webhook |
| `SENTRY_DSN` | Sentry DSN |
| `STREAM_API_KEY` | Stream API key |
| `STREAM_API_SECRET` | Stream API secret |
| `IMAGEKIT_PUBLIC_KEY` | ImageKit public key |
| `IMAGEKIT_PRIVATE_KEY` | ImageKit private key |
| `IMAGEKIT_URL_ENDPOINT` | ImageKit URL endpoint |
| `FRONTEND_URL` | Frontend origin (example uses `http://localhost:5173`) |
| `POLAR_ACCESS_TOKEN` | Polar access token |
| `POLAR_WEBHOOK_SECRET` | Signing secret for the Polar webhook |
| `POLAR_API_BASE` | Polar API base URL (example uses the sandbox, `https://sandbox-api.polar.sh`) |
| `POLAR_CHECKOUT_PRODUCT_ID` | Polar product ID used for checkout |

Environment variables are validated with Zod at startup (`src/lib/env.ts`).

Push the schema to Neon and seed sample data:

```bash
npm run db:push
npm run db:seed
```

Start the dev server:

```bash
npm run dev
```

**Backend scripts**

| Script | What it does |
| --- | --- |
| `npm run dev` | `tsx watch` with Sentry instrumentation loaded first |
| `npm run build` | Compile TypeScript with `tsc` |
| `npm start` | Run the compiled app (`dist/index.js`) with Sentry instrumentation loaded first |
| `npm run db:push` | Push the Drizzle schema to the database |
| `npm run db:seed` | Run `scripts/seed.ts` |

### 3. Frontend setup

```bash
cd Frontend
npm install
cp .env.example .env
npm run dev
```

Frontend environment variables must be prefixed with `VITE_`. Vite only exposes variables with that prefix to the browser bundle, which keeps other secrets out of it.

| Variable | Description |
| --- | --- |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `VITE_SENTRY_DSN` | Sentry DSN for the frontend |
| `VITE_API_URL` | Base URL of the API (the example uses `http://localhost:3001`). Leave it empty to call `/api` on the same host as the page, which is how the Docker image is built |

**Frontend scripts**

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |

### 4. Set up webhooks

New Clerk sign-ups don't automatically appear in the database; a webhook syncs them.

**Clerk**
1. In the Clerk dashboard, go to **Configure → Developers → Webhooks**.
2. Add an endpoint: `https://<your-domain>/webhooks/clerk`.
3. Subscribe to `user.created`, `user.updated`, and `user.deleted`.
4. Put the signing secret in `CLERK_WEBHOOK_SECRET`.

**Polar**
1. Add an endpoint: `https://<your-domain>/webhooks/polar`.
2. Put the secret in `POLAR_WEBHOOK_SECRET`.

For local development, you'll need a public URL that tunnels to your local backend (for example via ngrok).

---

## ☁️ Deployment (Render)

The app deploys as a single Docker container: Express serves the API and the built frontend from the same origin. The `Dockerfile` has three stages:

1. **Frontend build** (`node:22-bookworm-slim`): runs `npm run build` in `Frontend/` with `VITE_API_URL` empty (same-origin API calls) and `VITE_CLERK_PUBLISHABLE_KEY` passed as a build argument.
2. **Backend build**: compiles the TypeScript API with `npm run build` in `Backend/`.
3. **Runtime image**: installs production dependencies only, copies the compiled backend to `dist/` and the Vite build to `public/`, sets `NODE_ENV=production`, exposes port `3001`, and runs as the non-root `node` user with `node dist/index.js`.

To deploy on Render:

1. Create a **Web Service** from this repo using the Docker runtime (build context is the repo root).
2. Add the backend environment variables from the table above in the Render dashboard.
3. Make `VITE_CLERK_PUBLISHABLE_KEY` available to the Docker build as a build argument (the Dockerfile reads it with `ARG`).
4. Point the Clerk and Polar webhooks at your Render domain.

**Keeping the free tier awake:** Render shuts free services down after 15 minutes of inactivity. When `NODE_ENV` is `production` (the Docker image sets it), the server starts a cron job (`src/lib/cron.ts`) to keep the service active.

---

## 🔍 Monitoring

Sentry is wired into both layers:

- **Backend:** initialized in `instrument.ts`, which the `dev` and `start` scripts load first. Unhandled errors return a `500` JSON response that includes a `sentryId` when available.
- **Frontend:** the app is wrapped in a Sentry error boundary with a custom fallback component.
- **User context:** `sentryClerkUser.ts` (backend, registered right after the Clerk middleware) and `sentryUserSync.jsx` (frontend) attach the Clerk user ID to errors, so you can see which user hit a problem.

---

## 📝 Notes

- **Watermarks:** the watermark only appears on images hosted on ImageKit. Seed data uses Unsplash images (no watermark), while images uploaded through the admin dashboard are stored on ImageKit and are watermarked.

---


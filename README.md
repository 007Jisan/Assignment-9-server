# 🍕 PizzaHub — Backend REST API & Real-Time Engine (Server)

> Scalable Express.js & TypeScript REST API powering the PizzaHub platform with MongoDB Atlas cloud persistence, JWT role-based security, and Stripe payments.

---

## 🔗 Project Links
- **Live API Endpoint**: https://assignment-9-server-khaki.vercel.app/
- **Client GitHub Repository**: [https://github.com/007Jisan/Assignment-9](https://github.com/007Jisan/Assignment-9)
- **Server GitHub Repository**: [https://github.com/007Jisan/Assignment-9-server](https://github.com/007Jisan/Assignment-9-server)

---

## ✨ Key Features & Architecture

### 1. 🛡️ Authentication & Authorization
- **Bcrypt Password Encryption**: All passwords encrypted with 10 salt rounds before database persistence.
- **Stateless JWT**: Standard 7-day signed tokens containing user ID and role claims.
- **Authorized Admin Registration**: Requires server authorization passcode (`ADMIN_SECURITY_KEY=pizza-admin-2026`) preventing public creation of elevated accounts.
- **Server-Side Role Guard Middleware**: Restricts endpoint access strictly to authorized roles (`customer`, `vendor`, or `admin`).

### 2. 🍕 Menu Management & Business Rules
- **Free vs. Premium Quota**: Free tier vendors are limited to a maximum of 3 active/pending items. Upgrading to Premium lifts all item limits.
- **Admin Review Pipeline**: Submitted items start with `pending` status until reviewed and approved by an Admin.
- **Search, Filter & Pagination**: MongoDB regex search, category filtering, location filtering, and pagination.

### 3. 📦 Order Lifecycle
- **Duplicate Prevention**: Prevents duplicate active orders for the same item and delivery date.
- **Self-Ordering Prevention**: Prevents vendor accounts from placing customer orders on their own menu items.
- **Status Progression**: Orders transition through `pending` $\rightarrow$ `accepted` / `rejected` / `cancelled`.
- **Status Timeline**: Every status update appends an immutable timestamped note to `statusTimeline`.

### 4. 💳 Stripe Subscription & Webhook Pipeline
- **Stripe Checkout**: Generates checkout sessions for Vendor Premium upgrades ($19.99/mo).
- **Cryptographic Webhooks**: Validates `stripe-signature` via raw body parser; activates subscription and logs permanent transaction records only upon receiving verified `checkout.session.completed` events.

---

## 🎯 Challenge Requirements Implementation Details

### 1. Advanced Search & Sorting Implementation
- **Route**: `GET /api/menu`
- **Query Parameters**:
  - `search`: Case-insensitive regex matching across `itemName` and `description`.
  - `category`: Matches specific pizza categories (e.g., `Classic Pizzas`, `Meat Lovers`).
  - `location`: Case-insensitive regex matching city or restaurant area.
  - `sort`: Supports:
    - `price_asc`: `{ price: 1 }`
    - `price_desc`: `{ price: -1 }`
    - `rating`: `{ rating: -1, reviewCount: -1 }`
    - `newest`: `{ createdAt: -1 }`
  - `page` & `limit`: Standard skip-limit pagination with metadata response.

### 2. JWT Middleware & Token Verification Flow
- **Middleware**: `verifyToken` (`src/middleware/auth.ts`)
  - Extracts Bearer token from `Authorization` header or cookie.
  - Verifies signature using `JWT_SECRET`.
  - Fetches the user from MongoDB Atlas, stripping the password hash.
  - Checks `user.isBlocked`: returns `403 Forbidden` if suspended.
  - Injects `req.user` into the request pipeline.
- **Role Middleware**: `requireRole('admin' | 'vendor' | 'customer')`
  - Ensures only permitted roles proceed to the route handler.

---

## 🛠️ Technology Stack & Dependencies

| Category | Packages Used |
|---|---|
| **Runtime & Language** | `Node.js`, `Express.js` (v4.19.2), `TypeScript` (v5.4.5), `tsx` |
| **Database & ODM** | `mongodb`, `mongoose` (v8.3.1) |
| **Authentication & Cryptography** | `jsonwebtoken` (v9.0.2), `bcryptjs` (v2.4.3) |
| **Payment Gateway** | `stripe` (v15.3.0) |
| **Utilities & Middleware** | `cors`, `dotenv` |

---

## 🔑 Environment Variables

Configure a `.env` file in the root of the `server` directory:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/pizzahub?retryWrites=true&w=majority
JWT_SECRET=your_jwt_secret_key_change_in_production
CLIENT_URL=http://localhost:3000
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret
ADMIN_EMAIL=admin@pizzahub.com
ADMIN_PASSWORD=Admin@123456
ADMIN_SECURITY_KEY=pizza-admin-2026
```

---

## 💻 How to Run Locally

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Seed Database
Populate your MongoDB Atlas cluster with default admin, vendors, menu items, and initial reviews:
```bash
npm run seed
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Build and Run for Production
```bash
npm run build
npm start
```
The API will be available at [http://localhost:5000/api](http://localhost:5000/api).

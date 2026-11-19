# 🍕 PizzaHub — Backend REST API & Real-Time Engine

Express.js and MongoDB backend powering the PizzaHub platform with JWT role-based access control, Stripe checkout and webhooks, and database seeding.

## ✨ Features
- **Stateless JWT Authentication**: Passwords hashed with bcrypt (10 rounds). Custom token verification middleware.
- **Role-Based Authorization**: Distinct access controls for `customer`, `vendor`, and `admin` roles.
- **Account Suspension (Blocking)**: Server-side prevention of blocked users accessing protected endpoints.
- **Menu Query Engine**: Advanced keyword search, category filtering, location filtering, and price ascending/descending sorting.
- **Vendor Tier Management**: Free plan quota enforcement (max 3 items) vs unlimited Premium plan.
- **Order Business Logic**:
  - Automatically identifies customer, vendor, and item.
  - Enforces single active order per item/date.
  - Prevents vendors from ordering their own pizzas.
  - Status history timeline (`statusTimeline`).
  - Cancellation limited to pending state.
- **Stripe Integration**:
  - Checkout session creation.
  - Webhook listener with cryptographic signature verification.
  - Automatic vendor subscription activation and immutable transaction logging.
- **Seed Script**: Ready-to-go database seeder with pre-configured Admin, Vendors, Customers, Pizzas, and Orders.

## 📦 Tech Stack
- Express.js
- MongoDB & Mongoose
- TypeScript & tsx
- JSONWebToken
- Bcryptjs
- Stripe SDK
- CORS & Dotenv

## 🚀 Getting Started
```bash
npm install
npm run seed     # Populate database with realistic test data
npm run dev      # Start dev server on port 5000
```

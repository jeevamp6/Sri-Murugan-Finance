# 🏦 Sri Murugan Finance

A modern Finance Management System designed for personal lending businesses to manage customers, loans, collections, receipts, reports, and financial records efficiently.

## 🚀 Features

### 👥 User Management

* Admin Login
* Staff Login
* Customer Login
* Role-Based Access Control
* Secure Authentication (JWT)

### 👤 Customer Management

* Add Customers
* Edit Customers
* Soft Delete Customers
* Customer Search
* Customer Profile Management
* Aadhaar (Optional)
* Document Upload

### 💰 Loan Management

* Create Loans
* Edit Loans
* Close Loans
* Multiple Loans Per Customer
* Interest Calculation
* Outstanding Balance Tracking

### 💳 Collection Management

* Record Payments
* Cash Payments
* UPI Payments
* QR Code Payments
* Payment History
* Auto Balance Updates

### 🧾 Receipt System

* PDF Receipt Generation
* Download Receipts
* Print Receipts
* Receipt History

### 📊 Reports & Analytics

* Daily Collection Report
* Weekly Collection Report
* Monthly Collection Report
* Outstanding Report
* Defaulter Report
* Profit Report
* Export to PDF
* Export to Excel
* Export to CSV

### 📱 Customer Dashboard

Customers can view:

* Loan Details
* Payment History
* Remaining Balance
* Due Amount
* Due Dates
* Download Receipts

### 📈 Admin Dashboard

* Total Customers
* Active Loans
* Outstanding Amount
* Today's Collections
* Overdue Accounts
* Financial Analytics

### 🔒 Security

* JWT Authentication
* Password Hashing (bcrypt)
* Role-Based Access Control
* Protected API Routes
* Audit Logging
* Secure Data Storage

---

# 🛠️ Tech Stack

## Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* Recharts
* Lucide Icons

## Backend

* Node.js
* Express.js

## Database

* PostgreSQL (Production)
* SQLite (Development)

## Storage

* Cloudinary

## Deployment

* Netlify / Vercel (Frontend)
* Render / Railway (Backend)
* Supabase PostgreSQL

---

# 📂 Project Structure

```bash
Sri-Murugan-Finance/
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
│
├── backend/
│   ├── src/
│   ├── uploads/
│   ├── package.json
│   └── database/
│
├── docs/
├── README.md
└── LICENSE
```

---

# ⚙️ Installation

## Frontend

```bash
npm install
npm run dev
```

## Backend

```bash
npm install
npm run dev
```

---

# 🌐 Environment Variables

## Frontend

```env
VITE_API_URL=http://localhost:5000
```

## Backend

```env
PORT=5000

JWT_SECRET=your_jwt_secret

DATABASE_URL=your_postgresql_connection_string

CLOUDINARY_CLOUD_NAME=

CLOUDINARY_API_KEY=

CLOUDINARY_API_SECRET=
```

---

# 🚀 Deployment

## Frontend

Deploy using:

* Netlify
* Vercel

## Backend

Deploy using:

* Render
* Railway

## Database

Deploy using:

* Supabase PostgreSQL

---

# 💳 Payment System

Supports:

* Cash Payments
* UPI Payments
* QR Code Payments

QR Codes are dynamically generated using the Admin's UPI ID.

Example:

```text
upi://pay?pa=adminupi@bank
```

All payments are directed to the Admin account only.

---

# 📋 User Roles

## Admin

* Full System Access
* Customer Management
* Loan Management
* Report Management
* User Management

## Staff

* Collection Entry
* Customer Viewing
* Receipt Generation

## Customer

* View Loans
* View Payments
* Download Receipts
* View Balance

---

# 🔄 Backup & Recovery

* Automatic Daily Backup
* Audit Logs
* Data Recovery Support
* Soft Delete Functionality

---

# 🌍 Multi-Language Support

Supported Languages:

* English
* Tamil

---

# 📞 Support

Sri Murugan Finance

A complete finance management platform for personal lending businesses.

Built with ❤️ using React, Node.js, PostgreSQL, and modern web technologies.

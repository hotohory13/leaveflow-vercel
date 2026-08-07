# LeaveFlow - TA Leave Tracker Portal

A premium, modern web application designed for Teaching Assistants (TAs) in engineering faculties to easily record, monitor, and audit their leave days. 

The application is built with a **React (Vite) frontend** styled using custom, responsive glassmorphic vanilla CSS, backed by an **Express.js API** storing records in a lightweight, self-contained **SQLite database**.

---

## Features

- **Double-Quota Calculation System**:
  - **New TAs**: Auto-restricts leave to a **3-day limit** during the first 6 months from their contract start date.
  - **Established TAs**: Supports a **21-day limit** linked dynamically to the academic year (September 1st to August 31st).
- **Premium Visualization**:
  - A beautiful circular radial SVG indicator reflecting limit consumption.
  - Dynamic visual alert states: **Safe (Green)**, **Warning (Orange)**, and **Limit Exceeded (Red)**.
  - Interactive grid calendar displaying colored badges for filed leaves.
- **Secure Authentication**:
  - Password hashing via `bcryptjs` and session tokens using JSON Web Tokens (JWT).
- **Categories Supported**:
  - 🟢 **Annual Leave / اعتيادية** (`vacation`)
  - 🔴 **Sick Leave / مرضية** (`sick`)
  - 🟡 **Casual Leave / عرضة** (`casual`)
  - 🟣 **Other / آخرى** (`other`)
- **Reporting**: Ability to print or download a clean report via the **Export Report** button.

---

## Local Setup & Run

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (v18 or higher recommended).

### 1. Install Dependencies
Run the following helper script in the root folder to concurrently download all server packages and frontend packages:
```bash
npm run install-all
```

### 2. Run in Development
Start both servers locally to run in watch mode:

- **Start Backend API** (Runs on port `5000`):
  ```bash
  npm run dev
  ```
- **Start Frontend Client** (Runs on port `5173`):
  In a separate terminal tab:
  ```bash
  cd client
  npm run dev
  ```
Vite is configured to proxy all `/api` traffic from port `5173` to port `5000` automatically!

### 3. Run in Production serving (Single Port)
To build the React app and have the Express server host both the API and the client files from a single process:
```bash
# 1. Compile React build
npm run build

# 2. Start the Express server
npm start
```
Open `http://localhost:5000` in your web browser.

---

## Free Cloud Deployment (Get a Public Link)

You can deploy this entire application (frontend, backend, database) for free on **Render** using a single GitHub Repository.

### Step 1: Create a GitHub Repo
Push this project folder (`ta-leave-tracker`) to your personal GitHub account. Make sure to **exclude** `leaves.db`, `.env`, and `node_modules` folders (the `.gitignore` is already set up to handle this).

### Step 2: Deploy to Render
1. Create a free account on [Render](https://render.com/).
2. Click **New +** and select **Web Service**.
3. Connect your GitHub repository.
4. Set the following configurations:
   - **Name**: `ta-leave-tracker` (or any name you like)
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node server.js`
   - **Instance Type**: `Free`
5. Under the **Advanced** section:
   - Click **Add Environment Variable** and define:
     - `PORT` = `10000` (Render's default)
     - `JWT_SECRET` = `choose_your_own_secure_random_string`
     - `NODE_ENV` = `production`
6. Click **Deploy Web Service**.

*Note: Because SQLite is a file-based database, on Render's free tier, database records will reset when the instance restarts (which happens once a day or when deploying updates). If you want permanent storage, you can either attach a paid Render Disk, or plug in a free PostgreSQL database on Render and change the DB adapter. For general school testing and demonstration, the default SQLite setup is perfect and zero-cost!*

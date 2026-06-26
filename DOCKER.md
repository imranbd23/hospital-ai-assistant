# 🐳 Hospital AI Workspace Docker Setup

This project is fully containerized and can be launched locally using **Docker Compose**. The orchestration configures and wires up the PostgreSQL database, FastAPI Python core backend, full-stack React frontend, and pgAdmin administration panel.

---

## 🏗️ Architecture Stack

The multi-container application consists of the following services:

1. **`db`** (PostgreSQL 15):
   * Houses persistent data storage (patient profiles, consultation logs, and document metadata).
   * Persists data using a Docker named volume (`postgres_data`).
   * Uses standard healthchecks (`pg_isready`) to ensure secure startup timing.
2. **`fastapi_backend`** (Python 3.11):
   * Run uvicorn server for REST endpoints and runs Alembic migrations upon startup.
3. **`frontend`** (Node.js 20 & Python 3):
   * Serves the compiled production React UI (using Vite).
   * Runs the Express server backend to handle user authentication, session logs, and local FAISS-CPU clinical document indexing.
   * **Automatic Migration**: Automatically synchronizes PostgreSQL tables on boot utilizing `drizzle-kit push`.
4. **`pgadmin`** (pgAdmin 4):
   * A web-based graphical user interface to inspect and manage the PostgreSQL database tables.

---

## 🚀 How to Run

### 1. Prerequisites
Ensure you have the following installed on your host machine:
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)

### 2. Configure Secrets
Create a `.env` file in the root of this project (or supply them in your terminal environment) to populate API secrets:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Launch the Application Stack
Execute the following single command in the project root directory to build and boot up all containers:

```bash
docker compose up --build
```

To run the services in the background (detached mode):

```bash
docker compose up -d
```

### 4. Stop the Containers
To spin down the application while preserving the database volume storage:

```bash
docker compose down
```

To clean up all containers and clear the persistent database volume:

```bash
docker compose down -v
```

---

## 🔌 Accessible Service Ports

Once all containers are running successfully, you can access the various parts of the ecosystem at the following local URLs:

| Service | Protocol / Address | Description | Credentials / Default Settings |
| :--- | :--- | :--- | :--- |
| **React Frontend** | 🌐 [http://localhost:3000](http://localhost:3000) | Clinical RAG UI & Express Server | Default login options available on screen |
| **FastAPI Core** | ⚡ [http://localhost:8000](http://localhost:8000) | Python API & Health Probe | Swagger Docs: [http://localhost:8000/docs](http://localhost:8000/docs) |
| **pgAdmin 4** | 📊 [http://localhost:5050](http://localhost:5050) | Database Visual Browser | **Email**: `admin@hospital.com` <br> **Password**: `adminpassword` |
| **PostgreSQL DB** | 🗄️ `localhost:5432` | Raw Database Connection | **Host**: `db` (inside container network)<br>**User**: `hospital_admin`<br>**Password**: `password123`<br>**DB**: `hospital_ai` |

---

## 🛠️ Automated Database Synchronization

No manual migrations are required!
* The **FastAPI backend** automatically triggers `alembic upgrade head` before booting.
* The **React frontend** automatically triggers `npx drizzle-kit push --config=src/db/drizzle.config.ts` prior to launching the Express server, ensuring all schema modifications inside `src/db/schema.ts` are safely synchronized with Postgres immediately.

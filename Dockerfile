# ==================== BUILD STAGE ====================
FROM node:20-slim AS builder

WORKDIR /app

# Install system dependencies required for building native Node modules or running build scripts
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy package descriptors
COPY package*.json ./

# Install all dependencies (including devDependencies for build and migration steps)
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the frontend assets and compile server.ts to dist/server.js
RUN npm run build


# ==================== RUNTIME STAGE ====================
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

# Install runtime Python 3, pip, libpq (for Postgres), and curl (for health checks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Pre-install Python libraries required for local FAISS-CPU RAG execution
# Using --break-system-packages since this is a dedicated, single-purpose container
RUN pip3 install --no-cache-dir --break-system-packages \
    pymupdf \
    sentence-transformers \
    faiss-cpu \
    numpy

# Copy built application and required production packages from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/src/db ./src/db
COPY --from=builder /app/extract_pdf.py ./extract_pdf.py
COPY --from=builder /app/faiss_index.py ./faiss_index.py

# Create upload directory and grant read/write access
RUN mkdir -p uploads && chmod 777 uploads

EXPOSE 3000

# Health check to monitor Express container status
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/v1/health || exit 1

# Automatically push database schema using drizzle-kit, then boot up the Node.js server
CMD ["sh", "-c", "npx drizzle-kit push --config=src/db/drizzle.config.ts && npm run start"]

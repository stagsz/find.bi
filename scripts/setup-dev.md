# Development Setup Guide

## Quick Start

Follow these steps to set up your development environment and create the admin user.

### 1. Start Database Services

```bash
# Start PostgreSQL and Redis
docker compose up -d postgres redis

# Check if services are running
docker ps
```

You should see containers named:
- `hazop-postgres` (port 5432)
- `hazop-redis` (port 6379)

### 2. Run Database Migrations

```bash
# Run all migrations to create the database schema
cd apps/api
for file in ../../migrations/*.sql; do
  docker exec -i hazop-postgres psql -U hazop -d hazop < "$file"
done
cd ../..
```

### 3. Create Admin User

```bash
# Run the seed script to create the admin user
cd apps/api
npx tsx scripts/seed-admin.ts
cd ../..
```

This will create:
- **Email**: `admin@hazop.local`
- **Password**: `Admin123!`
- **Role**: `administrator`

### 4. Start the Backend API

```bash
# In one terminal
cd apps/api
npm run dev
```

The API will start on http://localhost:4000

### 5. Start the Frontend

```bash
# In another terminal
cd apps/web
npm run dev
```

The frontend will start on http://localhost:5173

### 6. Login

Navigate to http://localhost:5173 and login with:
- **Email**: admin@hazop.local
- **Password**: Admin123!

---

## Troubleshooting

### Database Connection Refused

If you get "ECONNREFUSED" errors:

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# If not running, start it
docker compose up -d postgres

# Check logs if it's failing
docker logs hazop-postgres
```

### Table Does Not Exist

If you get "table does not exist" errors, run the migrations:

```bash
# Run migrations manually
docker exec -i hazop-postgres psql -U hazop -d hazop -f /migrations/001_create_enum_types.sql
docker exec -i hazop-postgres psql -U hazop -d hazop -f /migrations/002_create_users_table.sql
# ... and so on for all migration files
```

### Admin User Already Exists

If the admin user already exists, you can reset the password:

```bash
# Connect to the database
docker exec -it hazop-postgres psql -U hazop -d hazop

# Delete existing admin user
DELETE FROM hazop.users WHERE email = 'admin@hazop.local';

# Then run the seed script again
```

### Port Already in Use

If port 4000 or 5173 is in use:

```bash
# Find what's using the port
# Windows:
netstat -ano | findstr :4000

# Linux/Mac:
lsof -i :4000

# Change the port in .env file:
# PORT=4001 (for backend)
# Or change vite.config.ts for frontend
```

---

## Alternative: Manual Admin User Creation

If the seed script isn't working, you can create the admin user manually:

### Generate Password Hash

```bash
node scripts/hash-password.js "Admin123!"
```

### Insert User Manually

```bash
docker exec -it hazop-postgres psql -U hazop -d hazop

# In the psql prompt:
INSERT INTO hazop.users (
  email,
  password_hash,
  name,
  role,
  organization,
  is_active
) VALUES (
  'admin@hazop.local',
  '$2b$10$W54S9ku5zpcq0DTm7pILeOcYTNRIunMqwbISCubzAP27SEvEPiGFu',
  'System Administrator',
  'administrator',
  'HazOp Systems',
  TRUE
);
```

---

## Environment Variables

The `.env` file has been created with development defaults. For production deployment, you MUST:

1. Generate new JWT keys:
   ```bash
   openssl genrsa -out private.pem 2048
   openssl rsa -in private.pem -pubout -out public.pem
   ```

2. Update database credentials
3. Change all default passwords
4. Set `NODE_ENV=production`

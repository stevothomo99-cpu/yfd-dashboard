# Supabase Setup for Multi-User Authentication

## Overview
This dashboard now supports multiple users with role-based access (admin/user). Users are stored in Supabase with simple email/password authentication.

## Setup Steps

### 1. Create a Supabase Project
- Go to [supabase.com](https://supabase.com)
- Create a new project
- Copy the project URL and anon key

### 2. Set Environment Variables
Add to your `.env.local` (development) or Vercel environment variables (production):

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Create the Users Table
In Supabase SQL Editor, run the migration:
```sql
-- migrations/001_create_dashboard_users.sql
```

Or manually create the table:
```sql
CREATE TABLE IF NOT EXISTS dashboard_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  username text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE dashboard_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view dashboard_users"
  ON dashboard_users FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admins to manage dashboard_users"
  ON dashboard_users FOR ALL USING (
    EXISTS (
      SELECT 1 FROM dashboard_users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE INDEX idx_dashboard_users_email ON dashboard_users(email);
CREATE INDEX idx_dashboard_users_username ON dashboard_users(username);
```

### 4. Add Your First Admin User
Access the user management page at `/settings/users` and create your admin account.

Alternatively, use the API:
```bash
curl -X POST https://your-domain.com/api/admin/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "steve@yourfinancedept.com.au",
    "username": "steve",
    "password": "your-secure-password",
    "role": "admin"
  }'
```

### 5. Add Kim as Admin User
- Go to `/settings/users` on your dashboard
- Click "Add New User"
- Fill in:
  - Email: kim@focablyed.com
  - Username: kim
  - Password: (set a secure password)
  - Role: Admin

Or use the API as shown above.

## Endpoints

### Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}
```

### Create User (admin only)
```bash
POST /api/admin/users
Content-Type: application/json

{
  "email": "kim@focablyed.com",
  "username": "kim",
  "password": "secure-password",
  "role": "admin"
}
```

### List Users (admin only)
```bash
GET /api/admin/users
```

## Next Steps (Optional)

1. Update the login page to use `/api/auth/login`
2. Add middleware to check user roles
3. Add logout functionality
4. Implement password reset
5. Add user deletion/editing endpoints

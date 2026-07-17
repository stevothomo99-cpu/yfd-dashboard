-- Create dashboard_users table
CREATE TABLE IF NOT EXISTS dashboard_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  username text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE dashboard_users ENABLE ROW LEVEL SECURITY;

-- Create RLS policy to allow authenticated users to view all users
CREATE POLICY "Allow authenticated users to view dashboard_users"
  ON dashboard_users
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Create RLS policy to allow admins to manage users
CREATE POLICY "Allow admins to manage dashboard_users"
  ON dashboard_users
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM dashboard_users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create index on email for faster lookups
CREATE INDEX idx_dashboard_users_email ON dashboard_users(email);
CREATE INDEX idx_dashboard_users_username ON dashboard_users(username);

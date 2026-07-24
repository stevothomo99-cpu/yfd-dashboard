"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import PageHeader from "@/components/dashboard/PageHeader";

interface User {
  id: string;
  email: string;
  username: string;
  role: "admin" | "user";
  created_at: string;
  suspended: boolean;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [submitting, setSubmitting] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (data.users) {
        setUsers(data.users);
      }
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Failed to create user" });
        return;
      }

      setMessage({ type: "success", text: `User ${username} created successfully` });
      setEmail("");
      setUsername("");
      setPassword("");
      setRole("user");
      setShowForm(false);
      fetchUsers();
    } catch (err) {
      setMessage({ type: "error", text: "Failed to create user" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleSuspend = async (user: User) => {
    const nextSuspended = !user.suspended;
    const verb = nextSuspended ? "pause" : "resume";
    if (!window.confirm(`${nextSuspended ? "Pause" : "Resume"} access for ${user.username} (${user.email})?`)) {
      return;
    }

    setBusyUserId(user.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suspended: nextSuspended }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || `Failed to ${verb} user` });
        return;
      }
      setMessage({ type: "success", text: `${user.username}'s access has been ${nextSuspended ? "paused" : "resumed"}.` });
      fetchUsers();
    } catch {
      setMessage({ type: "error", text: `Failed to ${verb} user` });
    } finally {
      setBusyUserId(null);
    }
  };

  const handleRemove = async (user: User) => {
    if (
      !window.confirm(
        `Permanently remove ${user.username} (${user.email})? This deletes their account entirely and can't be undone.`,
      )
    ) {
      return;
    }

    setBusyUserId(user.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Failed to remove user" });
        return;
      }
      setMessage({ type: "success", text: `${user.username} has been removed.` });
      fetchUsers();
    } catch {
      setMessage({ type: "error", text: "Failed to remove user" });
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="User Management"
        subtitle="Manage dashboard users and permissions"
      />

      <div className="mb-6 flex gap-4">
        <Link href="/settings">
          <button className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100">
            Staff & Sync
          </button>
        </Link>
        <button className="px-4 py-2 bg-gray-100 text-gray-900 rounded-lg font-medium">
          Dashboard Users
        </button>
        <Link href="/settings/security">
          <button className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100">
            My Security
          </button>
        </Link>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mb-6">
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {showForm ? "Cancel" : "Add New User"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Create New User</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="kim@focablyed.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="kim"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Temporary — they&rsquo;ll be required to set their own password the first time they sign in.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "admin" | "user")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create User"}
            </button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold">Email</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Username</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Role</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Created</th>
                <th className="px-6 py-3 text-right text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-3 text-center text-gray-500">
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-3 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm">{user.email}</td>
                    <td className="px-6 py-3 text-sm">{user.username}</td>
                    <td className="px-6 py-3 text-sm">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          user.role === "admin"
                            ? "bg-red-100 text-red-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          user.suspended ? "bg-gray-200 text-gray-700" : "bg-green-100 text-green-800"
                        }`}
                      >
                        {user.suspended ? "Paused" : "Active"}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3 text-sm text-right whitespace-nowrap">
                      <button
                        onClick={() => handleToggleSuspend(user)}
                        disabled={busyUserId === user.id}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50 mr-4"
                      >
                        {user.suspended ? "Resume" : "Pause"}
                      </button>
                      <button
                        onClick={() => handleRemove(user)}
                        disabled={busyUserId === user.id}
                        className="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

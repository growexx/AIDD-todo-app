'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import type { Todo, TodoFormData } from '@/types';
import Navbar from '@/components/Navbar';
import SearchBar from '@/components/SearchBar';
import TodoForm from '@/components/TodoForm';
import TodoCard from '@/components/TodoCard';

function normalizeTodo(raw: Record<string, unknown>): Todo {
  return {
    id: (raw._id ?? raw.id) as string,
    title: (raw.title as string) ?? '',
    description: (raw.description as string) ?? '',
    completed: Boolean(raw.completed),
    priority: (raw.priority as Todo['priority']) ?? 'medium',
    dueDate: raw.dueDate ? new Date(raw.dueDate as string).toISOString().split('T')[0] : null,
    user: (raw.user as string) ?? '',
    createdAt: (raw.createdAt as string) ?? new Date().toISOString(),
    updatedAt: (raw.updatedAt as string) ?? new Date().toISOString(),
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [hydrated, setHydrated] = useState(false);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCompleted, setFilterCompleted] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);

  const fetchTodos = useCallback(
    async (params: { search?: string; completed?: string; priority?: string }) => {
      try {
        const { data } = await api.get<{
          success: true;
          data: { items: Record<string, unknown>[]; total: number };
        }>('/api/todos', { params });
        const items = (data.data?.items ?? []).map(normalizeTodo);
        setTodos(items);
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        toast.error(msg || 'Something went wrong');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    const timer = setTimeout(() => {
      fetchTodos({
        search: search || undefined,
        completed: filterCompleted || undefined,
        priority: filterPriority || undefined,
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [hydrated, isAuthenticated, router, search, filterCompleted, filterPriority, fetchTodos]);

  const handleCreate = async (formData: TodoFormData) => {
    setSubmitting(true);
    try {
      const { data } = await api.post<{ success: true; data: Record<string, unknown> }>(
        '/api/todos',
        formData,
      );
      const newTodo = normalizeTodo(data.data);
      setTodos((prev) => [newTodo, ...prev]);
      setShowForm(false);
      toast.success((data.data as { message?: string })?.message || 'Todo created successfully');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (formData: TodoFormData) => {
    if (!editingTodo) return;
    setSubmitting(true);
    try {
      const { data } = await api.patch<{ success: true; data: Record<string, unknown> }>(
        `/api/todos/${editingTodo.id}`,
        formData,
      );
      const updated = normalizeTodo(data.data);
      setTodos((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setEditingTodo(null);
      toast.success((data.data as { message?: string })?.message || 'Todo updated successfully');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      const { data } = await api.patch<{ success: true; data: Record<string, unknown> }>(
        `/api/todos/${id}/toggle`,
      );
      const toggled = normalizeTodo(data.data);
      setTodos((prev) => prev.map((t) => (t.id === toggled.id ? toggled : t)));
      toast.success((data.data as { message?: string })?.message || 'Todo updated successfully');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Something went wrong');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { data } = await api.delete<{ success: true; data: { message?: string } }>(
        `/api/todos/${id}`,
      );
      setTodos((prev) => prev.filter((t) => t.id !== id));
      toast.success(data.data?.message || 'Todo deleted successfully');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Something went wrong');
    }
  };

  if (!hydrated) return null;

  return (
    <div className="min-h-screen bg-zinc-100">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-zinc-800">Dashboard</h1>
          <button
            type="button"
            onClick={() => { setShowForm(true); setEditingTodo(null); }}
            className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
          >
            Add Todo
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-4">
          <div className="min-w-[200px] flex-1">
            <SearchBar value={search} onChange={setSearch} placeholder="Search todos…" />
          </div>
          <select
            value={filterCompleted}
            onChange={(e) => setFilterCompleted(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2"
          >
            <option value="">All</option>
            <option value="true">Completed</option>
            <option value="false">Pending</option>
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2"
          >
            <option value="">All priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div className="mb-6 flex gap-4 text-sm text-zinc-600">
          <span>Total: {todos.length}</span>
          <span>Completed: {todos.filter((t) => t.completed).length}</span>
          <span>Pending: {todos.filter((t) => !t.completed).length}</span>
        </div>

        {showForm && (
          <div className="mb-6">
            <TodoForm
              onSubmit={handleCreate}
              onCancel={() => setShowForm(false)}
              loading={submitting}
            />
          </div>
        )}

        {editingTodo && (
          <div className="mb-6">
            <TodoForm
              onSubmit={handleUpdate}
              onCancel={() => setEditingTodo(null)}
              initialData={{
                id: editingTodo.id,
                title: editingTodo.title,
                description: editingTodo.description,
                priority: editingTodo.priority,
                dueDate: editingTodo.dueDate ?? '',
              }}
              loading={submitting}
            />
          </div>
        )}

        {loading ? (
          <p className="text-zinc-500">Loading…</p>
        ) : (
          <ul className="space-y-3">
            {todos.map((todo) => (
              <li key={todo.id}>
                <TodoCard
                  todo={todo}
                  onToggle={handleToggle}
                  onEdit={setEditingTodo}
                  onDelete={handleDelete}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

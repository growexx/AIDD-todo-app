'use client';

import { useState } from 'react';
import type { TodoFormData } from '@/types';

interface TodoFormProps {
  onSubmit: (data: TodoFormData) => void;
  onCancel: () => void;
  initialData?: Partial<TodoFormData & { id?: string }>;
  loading: boolean;
}

const todayMin = () => new Date().toISOString().split('T')[0];

export default function TodoForm({
  onSubmit,
  onCancel,
  initialData,
  loading,
}: TodoFormProps) {
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>(
    initialData?.priority ?? 'medium',
  );
  const [dueDate, setDueDate] = useState(initialData?.dueDate ?? '');
  const [dueDateError, setDueDateError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDueDateError(null);
    if (dueDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selected = new Date(dueDate);
      selected.setHours(0, 0, 0, 0);
      if (selected < today) {
        setDueDateError('Due date cannot be in the past');
        return;
      }
    }
    onSubmit({ title: title.trim(), description: description.trim(), priority, dueDate });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded border border-zinc-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded border border-zinc-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Priority</label>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
          className="w-full rounded border border-zinc-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Due date</label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          min={todayMin()}
          className="w-full rounded border border-zinc-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {dueDateError && <p className="mt-1 text-sm text-red-600">{dueDateError}</p>}
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {initialData?.id ? 'Update Todo' : 'Add Todo'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-zinc-300 px-4 py-2 text-zinc-700 hover:bg-zinc-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

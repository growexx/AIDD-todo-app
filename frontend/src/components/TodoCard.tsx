'use client';

import React from 'react';
import type { Todo } from '@/types';

interface TodoCardProps {
  todo: Todo;
  onToggle: (id: string) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (id: string) => void;
}

const priorityColors: Record<string, string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-amber-100 text-amber-800',
  high: 'bg-red-100 text-red-800',
};

function TodoCardInner({ todo, onToggle, onEdit, onDelete }: TodoCardProps) {
  const priorityClass = priorityColors[todo.priority] ?? 'bg-zinc-100 text-zinc-800';

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3
            className={`font-medium text-zinc-800 ${todo.completed ? 'line-through text-zinc-500' : ''}`}
          >
            {todo.title}
          </h3>
          {todo.description && (
            <p className="mt-1 text-sm text-zinc-600">{todo.description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${priorityClass}`}>
              {todo.priority}
            </span>
            {todo.dueDate && (
              <span className="text-xs text-zinc-500">Due: {todo.dueDate}</span>
            )}
            <span className="text-xs text-zinc-400">
              Created: {new Date(todo.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => onToggle(todo.id)}
            className="rounded bg-zinc-100 px-2 py-1 text-sm hover:bg-zinc-200"
          >
            {todo.completed ? 'Undo' : 'Done'}
          </button>
          <button
            type="button"
            onClick={() => onEdit(todo)}
            className="rounded bg-blue-100 px-2 py-1 text-sm text-blue-800 hover:bg-blue-200"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(todo.id)}
            className="rounded bg-red-100 px-2 py-1 text-sm text-red-800 hover:bg-red-200"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(TodoCardInner);

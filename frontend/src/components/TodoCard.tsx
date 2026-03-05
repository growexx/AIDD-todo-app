'use client';

import React, { useState } from 'react';
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
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const priorityClass = priorityColors[todo.priority] ?? 'bg-zinc-100 text-zinc-800';

  const handleDeleteClick = () => {
    setPendingDeleteId(todo.id);
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (pendingDeleteId) {
      onDelete(pendingDeleteId);
      setPendingDeleteId(null);
    }
    setIsDeleteConfirmOpen(false);
  };

  const handleCancelDelete = () => {
    setPendingDeleteId(null);
    setIsDeleteConfirmOpen(false);
  };

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
            onClick={handleDeleteClick}
            className="rounded bg-red-100 px-2 py-1 text-sm text-red-800 hover:bg-red-200"
          >
            Delete
          </button>
        </div>
      </div>

      {isDeleteConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
        >
          <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-4 shadow-lg">
            <h2 id="delete-dialog-title" className="font-medium text-zinc-800">
              Delete todo?
            </h2>
            <p className="mt-2 text-sm text-zinc-600">
              Are you sure you want to delete &quot;{todo.title}&quot;?.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelDelete}
                className="rounded bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="rounded bg-red-100 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-200"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(TodoCardInner);

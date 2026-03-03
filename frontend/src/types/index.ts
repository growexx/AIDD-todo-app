/**
 * Backend wraps all responses via ResponseInterceptor as { success: true, data: T }.
 * Every axios call must use response.data.data to get the actual payload.
 */

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Todo {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  dueDate: string | null;
  user: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginFormData {
  email: string;
  password: string;
}

export interface TodoFormData {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  dueDate: string;
}

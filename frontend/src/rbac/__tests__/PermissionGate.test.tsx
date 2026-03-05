import React from 'react';
import { render, screen } from '@testing-library/react';
import { PermissionGate } from '../PermissionGate';
import { PermissionContext } from '../PermissionProvider';

describe('PermissionGate', () => {
  it('renders children when context has permission', () => {
    const value = {
      permissions: ['role:view'],
      isLoading: false,
      error: null,
      hasPermission: (p: string) => p === 'role:view',
      refreshPermissions: async () => {},
    };
    render(
      <PermissionContext.Provider value={value}>
        <PermissionGate permission="role:view">
          <span>Content</span>
        </PermissionGate>
      </PermissionContext.Provider>,
    );
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders fallback when user lacks permission', () => {
    const value = {
      permissions: [],
      isLoading: false,
      error: null,
      hasPermission: () => false,
      refreshPermissions: async () => {},
    };
    render(
      <PermissionContext.Provider value={value}>
        <PermissionGate permission="role:view" fallback={<span>Access denied</span>}>
          <span>Content</span>
        </PermissionGate>
      </PermissionContext.Provider>,
    );
    expect(screen.getByText('Access denied')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('renders loadingFallback while loading', () => {
    const value = {
      permissions: [],
      isLoading: true,
      error: null,
      hasPermission: () => false,
      refreshPermissions: async () => {},
    };
    render(
      <PermissionContext.Provider value={value}>
        <PermissionGate permission="role:view" loadingFallback={<span>Loading...</span>}>
          <span>Content</span>
        </PermissionGate>
      </PermissionContext.Provider>,
    );
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders fallback when context is null', () => {
    render(
      <PermissionContext.Provider value={null}>
        <PermissionGate permission="role:view" fallback={<span>No provider</span>}>
          <span>Content</span>
        </PermissionGate>
      </PermissionContext.Provider>,
    );
    expect(screen.getByText('No provider')).toBeInTheDocument();
  });
});

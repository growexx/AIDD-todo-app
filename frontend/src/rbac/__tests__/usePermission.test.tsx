import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { usePermission } from '../usePermission';
import { PermissionProvider } from '../PermissionProvider';

describe('usePermission', () => {
  it('throws when used outside PermissionProvider', () => {
    expect(() => {
      renderHook(() => usePermission('role:view'));
    }).toThrow('usePermission must be used within a PermissionProvider');
  });

  it('returns hasPermission and isLoading from provider', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PermissionProvider userId={null}>{children}</PermissionProvider>
    );
    const { result } = renderHook(() => usePermission('role:view'), { wrapper });
    expect(result.current).toHaveProperty('hasPermission');
    expect(result.current).toHaveProperty('isLoading');
    expect(typeof result.current.hasPermission).toBe('boolean');
    expect(typeof result.current.isLoading).toBe('boolean');
  });

  it('returns hasPermission boolean from provider', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PermissionProvider userId={null}>{children}</PermissionProvider>
    );
    const { result } = renderHook(() => usePermission('role:view'), { wrapper });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(result.current.hasPermission).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });
});

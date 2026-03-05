import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { PermissionProvider } from '../PermissionProvider';

const mockGet = jest.fn();

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

describe('PermissionProvider', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('sets isLoading false and empty permissions when userId is null', async () => {
    render(
      <PermissionProvider userId={null}>
        <span>Child</span>
      </PermissionProvider>,
    );
    expect(screen.getByText('Child')).toBeInTheDocument();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('fetches permissions when userId is set', async () => {
    mockGet.mockResolvedValue({
      data: { data: { userId: 'u1', permissions: ['role:view'] } },
    });
    render(
      <PermissionProvider userId="u1">
        <span>Child</span>
      </PermissionProvider>,
    );
    expect(screen.getByText('Child')).toBeInTheDocument();
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining('/api/rbac/users/u1/permissions'),
      );
    });
  });

  it('handles fetch error without crashing', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <PermissionProvider userId="u1">
        <span>Child</span>
      </PermissionProvider>,
    );
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalled();
    });
    consoleSpy.mockRestore();
  });
});

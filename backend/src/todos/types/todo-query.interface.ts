/**
 * Query parameters for listing todos (search, filters, pagination).
 */
export interface TodoQuery {
  search?: string;
  completed?: string;
  priority?: string;
  page?: string;
  limit?: string;
}

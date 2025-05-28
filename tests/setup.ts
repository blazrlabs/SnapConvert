import { vi, beforeEach, Mock } from 'vitest';

const mockWebhook = vi.fn();

// Mock the authenticate module
vi.mock("@shopify/shopify-app-remix/server", () => ({
  authenticate: {
    webhook: mockWebhook
  }
}));

// Utility function to create a mock request
export function createMockRequest(options: {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
}) {
  const {
    url = 'http://localhost:3000',
    method = 'POST',
    headers = {},
    body = null
  } = options;

  return new Request(url, {
    method,
    headers: new Headers(headers),
    body: body ? JSON.stringify(body) : null,
  });
}

// Utility function to mock webhook authentication
export function mockWebhookAuth(mockResponse: {
  topic: string;
  shop: string;
  payload: any;
  webhookId: string;
  apiVersion: string;
}) {
  mockWebhook.mockImplementation(() => Promise.resolve(mockResponse));
  return mockWebhook;
}

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
}); 
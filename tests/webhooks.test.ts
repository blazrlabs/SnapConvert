import { describe, it, expect, vi } from 'vitest';
import { createMockRequest, mockWebhookAuth } from './setup';
import { webhookHandler } from '../app/webhooks';

describe('Webhook Handler', () => {
  it('should process product update webhooks correctly', async () => {
    // Mock the webhook authentication response
    const mockWebhookResponse = {
      topic: 'PRODUCTS_UPDATE',
      shop: 'test-shop.myshopify.com',
      payload: {
        id: '123456789',
        title: 'Updated Product',
        variants: []
      },
      webhookId: 'webhook-id-123',
      apiVersion: '2024-01'
    };

    // Setup the webhook auth mock
    mockWebhookAuth(mockWebhookResponse);

    // Create a mock request
    const mockRequest = createMockRequest({
      headers: {
        'x-shopify-topic': 'products/update',
        'x-shopify-shop-domain': 'test-shop.myshopify.com',
      },
      body: mockWebhookResponse.payload
    });

    // Call your webhook handler
    const response = await webhookHandler(mockRequest);

    // Assert the response
    expect(response.status).toBe(200);
  });

  it('should handle invalid webhooks appropriately', async () => {
    // Setup the webhook auth mock to throw an error
    const mockWebhook = mockWebhookAuth({} as any);
    mockWebhook.mockRejectedValueOnce(new Error('Invalid webhook'));

    const mockRequest = createMockRequest({
      headers: {
        'x-shopify-topic': 'invalid/topic',
      }
    });

    // Call your webhook handler
    const response = await webhookHandler(mockRequest);

    // Assert the error response
    expect(response.status).toBe(401);
  });
}); 
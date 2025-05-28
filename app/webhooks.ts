import { authenticate } from "@shopify/shopify-app-remix/server";

export async function webhookHandler(request: Request) {
  try {
    const { topic, shop, payload } = await authenticate.webhook(request);
    
    switch (topic) {
      case 'PRODUCTS_UPDATE':
        // Handle product update
        console.log(`Processing product update for shop ${shop}:`, payload);
        return new Response(null, { status: 200 });
      
      default:
        console.log(`Unhandled webhook topic ${topic}`);
        return new Response(null, { status: 200 });
    }
  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response(null, { status: 401 });
  }
} 
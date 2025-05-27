// app/routes/webhooks.ts

import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server"; // Make sure this path is correct
import db from "../db.server"; // Make sure this path is correct

export async function action({ request }: ActionFunctionArgs) {
  console.log("Webhook received!"); // Log for debugging

  // 1. Authenticate the webhook request
  // This verifies that the request truly came from Shopify and provides the payload.
  const { payload, shop } = await authenticate.webhook(request);

  if (!payload) {
    // If authentication fails or payload is missing
    console.error("Webhook authentication failed or payload missing.");
    return new Response("Webhook authentication failed or payload missing.", { status: 401 });
  }

  // 2. Extract product data from the webhook payload
  // The 'products/update' webhook payload directly contains the product object.
  // Shopify's webhook payload will use 'body_html' for descriptions.
  const { id, title, body_html } = payload as any; // Cast to 'any' for quick access, consider proper typing later

  if (!id || !title) {
    console.error("Missing product ID or title in webhook payload.");
    return new Response("Missing required product data.", { status: 400 });
  }

  console.log(`Processing product update for ID: ${id}, Title: ${title}`);

  try {
    // 3. Update the database using Prisma
    // We'll use 'upsert' to either update an existing product or create it if it doesn't exist.
    // The 'shopifyId' in your Product model should match the 'id' from the webhook payload.
    await db.product.upsert({
      where: { shopifyId: id }, // Use shopifyId for lookup, as it's unique
      update: {
        title: title,
        descriptionHtml: body_html || "", // Map body_html from webhook to descriptionHtml in your DB
        updatedAt: new Date(),
      },
      create: {
        // As per your schema, 'id' must be provided. Use the Shopify ID for both 'id' and 'shopifyId'.
        id: id,
        shopifyId: id,
        title: title,
        descriptionHtml: body_html || "",
        shopId: shop, // Get the shop directly from the webhook authentication
      },
    });

    console.log(`Product ID ${id} updated/created in DB.`);

    // 4. Respond to Shopify
    // Shopify expects a 200 OK response to confirm successful receipt and processing.
    return new Response(null, { status: 200 });

  } catch (error) {
    console.error(`Error processing webhook for product ID ${id}:`, error);
    // Return a 500 status to Shopify if there was an error processing the webhook
    return new Response("Failed to process webhook.", { status: 500 });
  }
}
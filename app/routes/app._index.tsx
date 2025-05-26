// app/routes/app._index.tsx

import { useEffect } from "react";
import { json, type ActionFunctionArgs, type LoaderFunctionArgs, type TypedResponse } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Box,
  List,
  Link,
  InlineStack,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// Define a type for your product data
interface Product {
  id: string;
  title: string;
  descriptionHtml: string;
}

// Helper function for saving products to the database
async function saveProductsToDatabase(shopDomain: string, products: Product[]) {
  console.log(`Saving ${products.length} products for shop: ${shopDomain}`);

  // First, ensure the shop exists
  const shop = await db.shop.upsert({
    where: { id: shopDomain },
    update: { updatedAt: new Date() },
    create: { id: shopDomain },
  });

  console.log(`Shop record ensured for: ${shopDomain}`);

  // Save each product
  for (const product of products) {
    await db.product.upsert({
      where: { shopifyId: product.id }, // Use shopifyId for lookup as it's @unique
      update: {
        title: product.title,
        descriptionHtml: product.descriptionHtml || "",
        updatedAt: new Date(),
      },
      create: {
        // As per your schema.prisma, 'id' is @id but has no default, so it must be provided.
        // We'll use the Shopify product's Global ID for Prisma's 'id'.
        id: product.id,
        shopifyId: product.id, // Store the Shopify Global ID here as well
        title: product.title,
        descriptionHtml: product.descriptionHtml || "",
        shopId: shopDomain,
      },
    });
    console.log(`Saved product: ${product.title}`);
  }
}

export const loader = async ({ request }: LoaderFunctionArgs): Promise<TypedResponse<{ products: Product[] }>> => {
  const { admin, session } = await authenticate.admin(request);
  const { shop } = session;

  let allProducts: Product[] = [];
  let hasNextPage = true;
  let endCursor: string | null = null;
  const PRODUCTS_PER_PAGE = 50; // You can adjust this number

  // INTEGRATE PAGINATION LOGIC INTO THE LOADER
  while (hasNextPage) {
    const query = `#graphql
      query getProducts($first: Int!, $after: String) {
        products(first: $first, after: $after) {
          edges {
            node {
              id
              title
              descriptionHtml
            }
            cursor
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    // Explicitly type 'response' and 'data'
    const response: Response = await admin.graphql(query, {
      variables: {
        first: PRODUCTS_PER_PAGE,
        after: endCursor,
      },
    });

    const { data }: { data: any } = await response.json(); // Explicitly type 'data'
    const productsPage: Product[] = data.products.edges.map((edge: any) => edge.node);

    allProducts.push(...productsPage);

    hasNextPage = data.products.pageInfo.hasNextPage;
    endCursor = data.products.pageInfo.endCursor;
  }

  // Save ALL fetched products to database
  try {
    await saveProductsToDatabase(shop, allProducts);
    console.log("All products successfully saved to database");
  } catch (error) {
    console.error("Error saving products to database:", error);
  }

  return json({ products: allProducts });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const color = ["Red", "Orange", "Yellow", "Green"][
    Math.floor(Math.random() * 4)
  ];
  const response = await admin.graphql(
    `#graphql
      mutation populateProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            handle
            status
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  barcode
                  createdAt
                }
              }
            }
          }
        }
      }`,
    {
      variables: {
        product: {
          title: `${color} Snowboard`,
        },
      },
    },
  );
  const responseJson = await response.json();

  const product = responseJson.data!.productCreate!.product!;
  const variantId = product.variants.edges[0]!.node!.id!;

  const variantResponse = await admin.graphql(
    `#graphql
    mutation shopifyRemixTemplateUpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
          barcode
          createdAt
        }
      }
    }`,
    {
      variables: {
        productId: product.id,
        variants: [{ id: variantId, price: "100.00" }],
      },
    },
  );

  const variantResponseJson = await variantResponse.json();

  return {
    product: responseJson!.data!.productCreate!.product,
    variant:
      variantResponseJson!.data!.productVariantsBulkUpdate!.productVariants,
  };
};

export default function Index() {
  const fetcher = useFetcher<typeof action>();
  const { products } = useLoaderData<typeof loader>();

  const shopify = useAppBridge();
  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";
  const productId = fetcher.data?.product?.id.replace(
    "gid://shopify/Product/",
    "",
  );

  useEffect(() => {
    if (productId) {
      shopify.toast.show("Product created");
    }
  }, [productId, shopify]);
  
  const generateProduct = () => fetcher.submit({}, { method: "POST" });

  return (
    <Page>
      <TitleBar title="Remix app template">
        <button variant="primary" onClick={generateProduct}>
          Generate a product
        </button>
      </TitleBar>
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Congrats on creating a new Shopify app 🎉
                  </Text>
                  <Text variant="bodyMd" as="p">
                    This embedded app template uses{" "}
                    <Link
                      url="https://shopify.dev/docs/apps/tools/app-bridge"
                      target="_blank"
                      removeUnderline
                    >
                      App Bridge
                    </Link>{" "}
                    interface examples like an{" "}
                    <Link url="/app/additional" removeUnderline>
                      additional page in the app nav
                    </Link>
                    , as well as an{" "}
                    <Link
                      url="https://shopify.dev/docs/api/admin-graphql"
                      target="_blank"
                      removeUnderline
                    >
                      Admin GraphQL
                    </Link>{" "}
                    mutation demo, to provide a starting point for app
                    development.
                  </Text>
                </BlockStack>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">
                    Get started with products
                  </Text>
                  <Text as="p" variant="bodyMd">
                    Generate a product with GraphQL and get the JSON output for
                    that product. Learn more about the{" "}
                    <Link
                      url="https://shopify.dev/docs/api/admin-graphql/latest/mutations/productCreate"
                      target="_blank"
                      removeUnderline
                    >
                      productCreate
                    </Link>{" "}
                    mutation in our API references.
                  </Text>
                </BlockStack>
                <InlineStack gap="300">
                  <Button loading={isLoading} onClick={generateProduct}>
                    Generate a product
                  </Button>
                  {fetcher.data?.product && (
                    <Button
                      url={`shopify:admin/products/${productId}`}
                      target="_blank"
                      variant="plain"
                    >
                      View product
                    </Button>
                  )}
                </InlineStack>
                {fetcher.data?.product && (
                  <>
                    <Text as="h3" variant="headingMd">
                      {" "}
                      productCreate mutation
                    </Text>
                    <Box
                      padding="400"
                      background="bg-surface-active"
                      borderWidth="025"
                      borderRadius="200"
                      borderColor="border"
                      overflowX="scroll"
                    >
                      <pre style={{ margin: 0 }}>
                        <code>
                          {JSON.stringify(fetcher.data.product, null, 2)}
                        </code>
                      </pre>
                    </Box>
                    <Text as="h3" variant="headingMd">
                      {" "}
                      productVariantsBulkUpdate mutation
                    </Text>
                    <Box
                      padding="400"
                      background="bg-surface-active"
                      borderWidth="025"
                      borderRadius="200"
                      borderColor="border"
                      overflowX="scroll"
                    >
                      <pre style={{ margin: 0 }}>
                        <code>
                          {JSON.stringify(fetcher.data.variant, null, 2)}
                        </code>
                      </pre>
                    </Box>
                  </>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Fetched Product Descriptions (first {products.length})
                </Text>
                {products.length > 0 ? (
                  <List>
                    {products.map((product) => (
                      <List.Item key={product.id}>
                        <BlockStack gap="100">
                          <Text as="h3" variant="headingSm">
                            {product.title} (ID: {product.id.split('/').pop()})
                          </Text>
                          <div dangerouslySetInnerHTML={{ __html: product.descriptionHtml }} />
                        </BlockStack>
                      </List.Item>
                    ))}
                  </List>
                ) : (
                  <Text as="p" variant="bodyMd">
                    No products found, or check your development store.
                  </Text>
                )}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  App template specs
                </Text>
                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd">
                      Framework
                    </Text>
                    <Link
                      url="https://remix.run"
                      target="_blank"
                      removeUnderline
                    >
                      Remix
                    </Link>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd">
                      Database
                    </Text>
                    <Link
                      url="https://www.prisma.io/"
                      target="_blank"
                      removeUnderline
                    >
                      Prisma
                    </Link>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd">
                      Interface
                    </Text>
                    <span>
                      <Link
                        url="https://polaris.shopify.com"
                        target="_blank"
                        removeUnderline
                      >
                        Polaris
                      </Link>
                      {", "}
                      <Link
                        url="https://shopify.dev/docs/apps/tools/app-bridge"
                        target="_blank"
                        removeUnderline
                      >
                        App Bridge
                      </Link>
                    </span>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd">
                      API
                    </Text>
                    <Link
                      url="https://shopify.dev/docs/api/admin-graphql"
                      target="_blank"
                      removeUnderline
                    >
                      GraphQL API
                    </Link>
                  </InlineStack>
                </BlockStack>
              </BlockStack>
            </Card>
            
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Next steps
                </Text>
                <List>
                  <List.Item>
                    Build an{" "}
                    <Link
                      url="https://shopify.dev/docs/apps/getting-started/build-app-example"
                      target="_blank"
                      removeUnderline
                    >
                      {" "}
                      example app
                    </Link>{" "}
                    to get started
                  </List.Item>
                  <List.Item>
                    Explore Shopify's API with{" "}
                    <Link
                      url="https://shopify.dev/docs/apps/tools/graphiql-admin-api"
                      target="_blank"
                      removeUnderline
                    >
                      GraphiQL
                    </Link>
                  </List.Item>
                </List>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
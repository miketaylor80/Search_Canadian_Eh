export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { product } = req.query;
  if (!product) {
    return res.status(400).json({ error: "Missing product query parameter" });
  }

  const AMAZON_ASSOCIATES_TAG = process.env.NEXT_PUBLIC_AMAZON_ASSOCIATES_TAG;
  const AMAZON_ACCESS_KEY = process.env.NEXT_PUBLIC_AMAZON_ACCESS_KEY;
  const AMAZON_SECRET_KEY = process.env.NEXT_PUBLIC_AMAZON_SECRET_KEY;

  const endpoint = "https://webservices.amazon.ca/onca/xml"; // Amazon Canada API
  const params = new URLSearchParams({
    Service: "AWSECommerceService",
    Operation: "ItemSearch",
    AWSAccessKeyId: AMAZON_ACCESS_KEY,
    AssociateTag: AMAZON_ASSOCIATES_TAG,
    SearchIndex: "All",
    Keywords: product,
    ResponseGroup: "ItemAttributes,Offers"
  });

  const signedUrl = `${endpoint}?${params.toString()}&Signature=${AMAZON_SECRET_KEY}`;

  try {
    const response = await fetch(signedUrl);
    if (!response.ok) {
      return res.status(response.status).json({ error: "Amazon API Error" });
    }
    const xmlResponse = await response.text();
    return res.status(200).send(xmlResponse);
  } catch (error) {
    console.error("Error fetching Amazon data:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

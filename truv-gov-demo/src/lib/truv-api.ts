const TRUV_BASE_URL = process.env.TRUV_BASE_URL || "https://prod.truv.com/v1";
const TRUV_CLIENT_ID = process.env.TRUV_CLIENT_ID!;
const TRUV_SECRET = process.env.TRUV_SECRET!;

function getHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Access-Client-Id": TRUV_CLIENT_ID,
    "X-Access-Secret": TRUV_SECRET,
  };
}

export async function createUser(externalId: string) {
  const res = await fetch(`${TRUV_BASE_URL}/users/`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ external_user_id: externalId }),
  });
  if (!res.ok) throw new Error(`Failed to create user: ${res.statusText}`);
  return res.json();
}

export async function createBridgeToken(
  userId: string,
  productType: string,
  accountInfo?: { account_number: string; routing_number: string; bank_name: string }
) {
  const body: Record<string, unknown> = {
    product_type: productType,
    tracking_info: "gov-demo",
  };

  if (accountInfo) {
    body.account = accountInfo;
  }

  const res = await fetch(`${TRUV_BASE_URL}/users/${userId}/tokens/`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Failed to create bridge token: ${res.statusText}`);
  return res.json();
}

export async function exchangeToken(publicToken: string) {
  const res = await fetch(`${TRUV_BASE_URL}/link-access-tokens/`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ public_token: publicToken }),
  });
  if (!res.ok) throw new Error(`Failed to exchange token: ${res.statusText}`);
  return res.json();
}

const REPORT_PATHS: Record<string, string> = {
  voie: "income/report",
  voe: "employment/report",
  dds: "deposit-switch/report",
  voa: "assets/report",
  insurance: "insurance/report",
  pll: "pll/report",
  admin: "admin/report",
};

export async function getReport(linkId: string, productKey: string) {
  const path = REPORT_PATHS[productKey];
  if (!path) throw new Error(`Unknown product key: ${productKey}`);

  const res = await fetch(`${TRUV_BASE_URL}/links/${linkId}/${path}`, {
    method: "GET",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to get report: ${res.statusText}`);
  return res.json();
}

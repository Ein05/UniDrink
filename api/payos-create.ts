import { PayOS } from '@payos/node';

const payOS = new PayOS({
  clientId: process.env.PAYOS_CLIENT_ID || '',
  apiKey: process.env.PAYOS_API_KEY || '',
  checksumKey: process.env.PAYOS_CHECKSUM_KEY || '',
});

export default async function handler(req: any, res: any) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orderCodeText, totalPrice } = req.body;

    if (!orderCodeText || !totalPrice) {
      return res.status(400).json({ error: 'Missing required parameters: orderCodeText and totalPrice' });
    }

    // Extract numerical digits from orderCodeText (e.g. DH000005 -> 5)
    const numericMatch = orderCodeText.match(/\d+/);
    if (!numericMatch) {
      return res.status(400).json({ error: 'Invalid orderCodeText format' });
    }
    const orderCode = parseInt(numericMatch[0], 10);

    const baseUrl = req.headers.origin || 'http://localhost:3000';

    const paymentData = {
      orderCode,
      amount: Math.round(totalPrice),
      description: `UniDrink #${orderCodeText}`,
      items: [
        {
          name: `UniDrink #${orderCodeText}`,
          quantity: 1,
          price: Math.round(totalPrice),
        }
      ],
      returnUrl: `${baseUrl}/track?code=${orderCodeText}&payOSStatus=success`,
      cancelUrl: `${baseUrl}/track?code=${orderCodeText}&payOSStatus=cancelled`,
    };

    const paymentLink = await payOS.paymentRequests.create(paymentData);

    return res.status(200).json(paymentLink);
  } catch (error: any) {
    console.error('[PayOS Create] error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

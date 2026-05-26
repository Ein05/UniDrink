import { PayOS } from '@payos/node';
import { createClient } from '@supabase/supabase-js';

const payOS = new PayOS({
  clientId: process.env.PAYOS_CLIENT_ID || '',
  apiKey: process.env.PAYOS_API_KEY || '',
  checksumKey: process.env.PAYOS_CHECKSUM_KEY || '',
});

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

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
    // 1. Verify the webhook payload signature securely
    const webhookData = await payOS.webhooks.verify(req.body);

    console.log('[PayOS Webhook] Verified payload:', webhookData);

    // 2. Handle the confirmation webhook from PayOS dashboard
    if (
      webhookData.description === 'confirm-webhook' || 
      webhookData.desc === 'confirm-webhook' || 
      (req.body.data && req.body.data.desc === 'confirm-webhook')
    ) {
      return res.status(200).json({ success: true, message: 'Webhook confirmed successfully' });
    }

    const { orderCode, amount, code } = webhookData;

    // We expect success / code "00" for standard completed payments
    if (!orderCode || code !== '00') {
      return res.status(200).json({ success: true, message: 'Transaction not successful or skipped' });
    }

    // 3. Reconstruct the string order code (e.g. 5 -> DH000005)
    const orderCodeText = 'DH' + String(orderCode).padStart(6, '0');

    // 4. Fetch the order from Supabase
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('id, is_paid, status, total_price')
      .eq('order_code', orderCodeText)
      .maybeSingle();

    if (fetchError || !order) {
      console.error(`[PayOS Webhook] Order ${orderCodeText} not found in DB:`, fetchError);
      return res.status(404).json({ error: 'Order not found' });
    }

    // 5. Check if the order is already marked as paid (Idempotency check)
    if (order.is_paid) {
      console.log(`[PayOS Webhook] Order ${orderCodeText} is already paid. Skipping update.`);
      return res.status(200).json({ success: true, message: 'Order is already marked as paid' });
    }

    // 6. Update order status and payment flags in the database
    // We automatically move the order from pending to processing (pha chế) since they paid!
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        is_paid: true,
        status: 'processing'
      })
      .eq('id', order.id);

    if (updateError) {
      console.error(`[PayOS Webhook] Failed to update order ${orderCodeText}:`, updateError);
      return res.status(500).json({ error: 'Database update failed' });
    }

    // 7. Insert payment success entry into order_logs
    const { error: logError } = await supabase
      .from('order_logs')
      .insert({
        order_id: order.id,
        action_type: 'update_payment',
        description: `Thanh toán tự động qua PayOS thành công. Số tiền nhận: ${amount.toLocaleString('vi-VN')} VND. Mã giao dịch PayOS: ${webhookData.reference || 'N/A'}`
      });

    if (logError) {
      console.warn(`[PayOS Webhook] Warning: Failed to insert order log for ${orderCodeText}:`, logError);
    }

    console.log(`[PayOS Webhook] Order ${orderCodeText} successfully confirmed and updated to PAID.`);
    return res.status(200).json({ success: true, message: 'Payment processed and confirmed successfully' });

  } catch (error: any) {
    console.error('[PayOS Webhook] Verification or processing error:', error);
    return res.status(400).json({ error: error.message || 'Signature verification failed' });
  }
}

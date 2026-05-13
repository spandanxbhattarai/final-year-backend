import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

export const sendSMS = async (to: string, body: string): Promise<void> => {
  if (!client || !fromNumber) {
    console.warn('[Twilio] SMS not sent — missing credentials');
    return;
  }
  try {
    await client.messages.create({ body, from: fromNumber, to });
    console.log(`[Twilio] SMS sent to ${to}`);
  } catch (err) {
    console.error('[Twilio] Failed to send SMS:', err);
  }
};

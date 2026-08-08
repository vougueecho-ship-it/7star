import { connectToDatabase } from '@/lib/mongodb';
import Setting from '@/models/Setting';

const FCM_KEY = process.env.FCM_SERVER_KEY || 'AIzaSyCwvsPB6eSmtIbsD1gU2mFdm7fdn4l6HPo';

export async function sendAdminFcmNotification({
  title,
  body,
  data = {}
}: {
  title: string;
  body: string;
  data?: Record<string, any>;
}) {
  try {
    await connectToDatabase();

    const setting = await Setting.findOne({ key: 'admin_fcm_tokens' });
    if (!setting || !setting.value) {
      console.log('No admin FCM tokens registered yet.');
      return;
    }

    let tokens: string[] = [];
    try {
      tokens = JSON.parse(setting.value);
    } catch (e) {
      tokens = [setting.value];
    }

    if (!Array.isArray(tokens) || tokens.length === 0) {
      return;
    }

    // Filter out invalid/empty tokens
    const validTokens = Array.from(new Set(tokens.filter(Boolean)));

    for (const token of validTokens) {
      const payload = {
        to: token,
        priority: 'high',
        notification: {
          title,
          body,
          sound: 'default',
          android_channel_id: 'default_channel_id'
        },
        data: {
          ...data,
          title,
          body
        }
      };

      await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `key=${FCM_KEY}`
        },
        body: JSON.stringify(payload)
      }).catch(err => console.error('FCM send fetch error:', err));
    }
  } catch (err) {
    console.error('Error in sendAdminFcmNotification:', err);
  }
}

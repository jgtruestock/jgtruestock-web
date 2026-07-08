import { getJgtDb } from '../mongodb';

export async function getBindingByEmail(email: string) {
  const db = await getJgtDb();
  return db.collection('user_bindings').findOne({ email: email.toLowerCase() });
}

export async function getBindingByChannelId(channelId: string) {
  const db = await getJgtDb();
  return db.collection('user_bindings').findOne({ channelId });
}

export async function createBinding(data: {
  email: string;
  channelId: string;
  channelUrl: string;
  ip: string;
}) {
  const db = await getJgtDb();
  await db.collection('user_bindings').createIndex({ email: 1 }, { unique: true });
  await db.collection('user_bindings').createIndex({ channelId: 1 }, { unique: true });
  await db.collection('user_bindings').insertOne({
    ...data,
    email: data.email.toLowerCase(),
    boundAt: new Date(),
  });
  await db.collection('binding_logs').insertOne({
    ...data,
    email: data.email.toLowerCase(),
    action: 'bind',
    createdAt: new Date(),
  });
}

export async function deleteBinding(email: string, adminNote?: string) {
  const db = await getJgtDb();
  const existing = await db.collection('user_bindings').findOne({ email: email.toLowerCase() });
  if (existing) {
    await db.collection('binding_logs').insertOne({
      email: email.toLowerCase(),
      channelId: existing.channelId,
      channelUrl: existing.channelUrl,
      action: 'reset',
      ip: 'admin',
      adminNote,
      createdAt: new Date(),
    });
    await db.collection('user_bindings').deleteOne({ email: email.toLowerCase() });
  }
}

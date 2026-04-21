export function getLineLoginChannelIdFromLiffId(liffId: string): string | null {
  const trimmedLiffId = liffId.trim();
  const [channelId] = trimmedLiffId.split("-", 1);

  if (!channelId || !/^\d+$/.test(channelId)) {
    return null;
  }

  return channelId;
}
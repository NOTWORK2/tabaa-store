export const socialPlatforms = [
  { key: 'facebook', label: 'فيسبوك', domain: 'facebook.com', aliases: ['fb.com'] },
  { key: 'instagram', label: 'إنستغرام', domain: 'instagram.com' },
  { key: 'tiktok', label: 'تيك توك', domain: 'tiktok.com', prefix: '@' },
  { key: 'telegram', label: 'تيليغرام', domain: 't.me' },
  { key: 'youtube', label: 'يوتيوب', domain: 'youtube.com', prefix: '@' },
];

export function socialProfileUrl(platform, value) {
  const input = String(value ?? '').trim();
  if (!input) return '';
  const domains = [platform.domain, ...(platform.aliases || [])];
  const handle = input.replace(/^@/, '');
  if (/^[\p{L}\p{N}_-][\p{L}\p{N}._-]*$/u.test(handle) && !domains.includes(handle.toLowerCase())) {
    return `https://${platform.domain}/${platform.prefix || ''}${encodeURIComponent(handle)}`;
  }
  try {
    const url = new URL(/^https?:\/\//i.test(input) ? input : 'https://' + input);
    const validHost = domains.some(domain => url.hostname === domain || url.hostname.endsWith('.' + domain));
    if (!validHost || url.username || url.password || url.port || url.pathname === '/') return '';
    url.protocol = 'https:';
    return url.href;
  } catch {
    return '';
  }
}

export function cleanName(s) {
  if (!s || typeof s !== 'string') return '';
  const t = s.trim();
  return t || '';
}

/** First-name style label for greetings and header — uses profiles row when passed. */
export function getUserFirstName(userProfile, user) {
  const pfFirst = cleanName(userProfile?.first_name);
  if (pfFirst) {
    return pfFirst.charAt(0).toUpperCase() + pfFirst.slice(1).toLowerCase();
  }

  const fullProf = cleanName(userProfile?.full_name);
  if (fullProf) {
    const firstWord = fullProf.split(/\s+/)[0];
    return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
  }

  const metaFn = cleanName(user?.user_metadata?.first_name);
  if (metaFn) return metaFn.charAt(0).toUpperCase() + metaFn.slice(1).toLowerCase();

  if (user?.user_metadata?.full_name) {
    const fw = cleanName(user.user_metadata.full_name.split(/\s+/)[0]);
    if (fw) return fw.charAt(0).toUpperCase() + fw.slice(1).toLowerCase();
  }

  if (user?.user_metadata?.name) {
    const fw = cleanName(user.user_metadata.name.split(/\s+/)[0]);
    if (fw) return fw.charAt(0).toUpperCase() + fw.slice(1).toLowerCase();
  }

  if (user?.user_metadata?.display_name) {
    const fw = cleanName(user.user_metadata.display_name.split(/\s+/)[0]);
    if (fw) return fw.charAt(0).toUpperCase() + fw.slice(1).toLowerCase();
  }

  if (user?.email) {
    const local = user.email.split('@')[0];
    const alphaPrefix = local.match(/^[^\d]+/);
    const base =
      alphaPrefix?.[0]?.replace(/[._]/g, '') || local.replace(/[._]/g, '');
    if (base.length > 1) {
      return base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
    }
  }

  return 'Researcher';
}

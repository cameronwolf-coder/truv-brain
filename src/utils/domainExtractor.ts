const PERSONAL_EMAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'aol.com',
  'protonmail.com',
  'mail.com',
];

export interface DomainExtractionResult {
  domain: string | null;
  isPersonal: boolean;
  error?: string;
}

export function extractDomainFromEmail(email: string): DomainExtractionResult {
  if (!email || typeof email !== 'string') {
    return { domain: null, isPersonal: false, error: 'Invalid email' };
  }

  const trimmedEmail = email.trim().toLowerCase();

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return { domain: null, isPersonal: false, error: 'Invalid email format' };
  }

  const domain = trimmedEmail.split('@')[1];

  if (!domain) {
    return { domain: null, isPersonal: false, error: 'Could not extract domain' };
  }

  const isPersonal = PERSONAL_EMAIL_DOMAINS.includes(domain);

  return { domain, isPersonal, error: undefined };
}

export function isValidBusinessEmail(email: string): boolean {
  const result = extractDomainFromEmail(email);
  return !!result.domain && !result.isPersonal && !result.error;
}

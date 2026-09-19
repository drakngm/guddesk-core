import { prisma } from "@/lib/db";

/**
 * Free email providers — these domains should NOT auto-create companies.
 * Customers with gmail.com, yahoo.com, etc. are individuals, not companies.
 */
const FREE_EMAIL_PROVIDERS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.co.jp",
  "yahoo.fr",
  "yahoo.de",
  "yahoo.it",
  "yahoo.es",
  "yahoo.ca",
  "yahoo.com.au",
  "yahoo.com.br",
  "yahoo.co.in",
  "hotmail.com",
  "hotmail.co.uk",
  "hotmail.fr",
  "hotmail.de",
  "hotmail.it",
  "hotmail.es",
  "outlook.com",
  "outlook.co.uk",
  "live.com",
  "live.co.uk",
  "msn.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "protonmail.com",
  "proton.me",
  "pm.me",
  "zoho.com",
  "yandex.com",
  "yandex.ru",
  "mail.com",
  "email.com",
  "gmx.com",
  "gmx.de",
  "gmx.net",
  "web.de",
  "t-online.de",
  "comcast.net",
  "verizon.net",
  "att.net",
  "sbcglobal.net",
  "cox.net",
  "charter.net",
  "earthlink.net",
  "optonline.net",
  "fastmail.com",
  "fastmail.fm",
  "tutanota.com",
  "tuta.io",
  "hey.com",
  "mailfence.com",
  "rocketmail.com",
  "inbox.com",
  "qq.com",
  "163.com",
  "126.com",
  "sina.com",
  "naver.com",
  "daum.net",
  "rediffmail.com",
  "mail.ru",
]);

/**
 * Extract domain from an email address.
 * Returns null if the email is invalid.
 */
function extractDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  return email.slice(at + 1).toLowerCase().trim();
}

/**
 * Check if an email domain is a free email provider.
 */
export function isFreeEmailProvider(domain: string): boolean {
  return FREE_EMAIL_PROVIDERS.has(domain.toLowerCase());
}

/**
 * Auto-assign a visitor to a company based on their email domain.
 *
 * Logic:
 * 1. Extract domain from email
 * 2. Skip if domain is a free email provider
 * 3. Find existing company by domain in this workspace
 * 4. If found, link the visitor
 * 5. If not found, create a new company and link the visitor
 *
 * This is a fire-and-forget operation — errors are logged but not thrown.
 */
export async function autoAssignCompany(
  workspaceId: string,
  visitorId: string,
  email: string,
): Promise<void> {
  try {
    const domain = extractDomain(email);
    if (!domain || isFreeEmailProvider(domain)) return;

    // Check if visitor already has a company
    const visitor = await prisma.visitor.findUnique({
      where: { id: visitorId },
      select: { companyId: true },
    });
    if (visitor?.companyId) return; // Already assigned

    // Find or create company
    let company = await prisma.company.findUnique({
      where: {
        workspaceId_domain: { workspaceId, domain },
      },
      select: { id: true },
    });

    if (!company) {
      // Auto-create company from domain
      // Use domain as name initially (e.g. "acme.com" → "Acme")
      const autoName = domain.split(".")[0]!;
      const displayName = autoName.charAt(0).toUpperCase() + autoName.slice(1);

      company = await prisma.company.create({
        data: {
          workspaceId,
          name: displayName,
          domain,
          website: `https://${domain}`,
        },
        select: { id: true },
      });
    }

    // Link visitor to company
    await prisma.visitor.update({
      where: { id: visitorId },
      data: { companyId: company.id },
    });
  } catch (error) {
    // Log but don't throw — this is a best-effort operation
    console.error("Auto-assign company error:", error);
  }
}

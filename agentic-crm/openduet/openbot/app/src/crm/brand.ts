import logo from "tenant-brand";
import { appConfig } from "@/lib/generated/application-config";

const escapeXml = (text: string) =>
  text.replace(/[<>&"']/g, (char) => `&#${char.charCodeAt(0)};`);

// A letter on a rounded square, for a tenant package without a logo.
function monogram(letter: string, square: string, ink: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${square}"/><text x="16" y="22" font-family="system-ui, sans-serif" font-size="17" font-weight="600" fill="${ink}" text-anchor="middle">${escapeXml(letter)}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** The CRM's title and logo: the deployment's product name and logo, from its tenant package. */
export function crmBrand(productName = appConfig.brand.productName) {
  const letter = Array.from(productName.trim())[0]?.toUpperCase() ?? "C";
  return {
    title: productName,
    lightModeLogo: logo ?? monogram(letter, "#18181b", "#ffffff"),
    darkModeLogo: logo ?? monogram(letter, "#fafafa", "#18181b"),
  };
}

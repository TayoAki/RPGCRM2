import { readBrandingFromDocument } from '@/white-label/utils/readBrandingFromDocument';

// The server renders the branding into index.html, so it is final before any module runs.
export const BRANDING = readBrandingFromDocument();

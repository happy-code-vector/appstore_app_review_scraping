/** Extract App Store IDs from mixed text containing raw IDs, id-prefixed IDs, and/or full App Store URLs. */
export function parseAppIds(text: string): string[] {
  const ids = new Set<string>();

  // Extract IDs from App Store URLs: /id123456
  const urlPattern = /\/id(\d{5,})/g;
  let match: RegExpExecArray | null;
  while ((match = urlPattern.exec(text)) !== null) {
    ids.add(match[1]);
  }

  // Extract standalone IDs: bare digits (8+ digits) or id-prefixed
  const idPattern = /\bid(\d{5,})\b/g;
  while ((match = idPattern.exec(text)) !== null) {
    ids.add(match[1]);
  }

  // Also catch bare numeric IDs (not already captured by URL pattern)
  const barePattern = /(?<![\/\w])(\d{8,})(?!\d)/g;
  while ((match = barePattern.exec(text)) !== null) {
    ids.add(match[1]);
  }

  return Array.from(ids);
}

/**
 * Simple template renderer that replaces {{key}} with values
 */
export function renderTemplate(
  template: string,
  data: Record<string, string | number | boolean | undefined>,
): string {
  let result = template;

  for (const [key, value] of Object.entries(data)) {
    const placeholder = `{{${key}}}`;
    const replacement = value !== undefined ? String(value) : "";
    result = result.replace(new RegExp(placeholder, "g"), replacement);
  }

  return result;
}

/**
 * Conditional block rendering: {{#if key}}...{{/if}}
 */
export function renderConditional(
  template: string,
  data: Record<string, unknown>,
): string {
  let result = template;

  // Match {{#if key}}content{{/if}}
  const ifPattern = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;

  result = result.replace(ifPattern, (match, key, content) => {
    const value = data[key];
    // Render content if value is truthy
    return value ? content : "";
  });

  return result;
}

/**
 * Combined renderer: handles both variable substitution and conditionals
 */
export function render(
  template: string,
  data: Record<string, unknown>,
): string {
  // First handle conditionals
  let result = renderConditional(template, data);

  // Then handle variable substitution
  const flatData: Record<string, string | number | boolean | undefined> = {};
  for (const [key, value] of Object.entries(data)) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === undefined
    ) {
      flatData[key] = value;
    }
  }

  result = renderTemplate(result, flatData);

  return result;
}

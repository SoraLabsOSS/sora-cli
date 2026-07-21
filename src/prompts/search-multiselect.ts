import { isCancel, multiselect } from "@clack/prompts";

interface Item {
  category: string;
  label: string;
  value: string;
}

interface Options {
  items: Item[];
  message: string;
}

/**
 * Thin wrapper around @clack/prompts multiselect, grouped by category in
 * the option labels. Clack doesn't support live search natively, so this
 * keeps the option list flat but readable; swap for a custom renderer
 * later if the component count grows large enough to need filtering.
 */
export async function searchMultiselect(
  options: Options
): Promise<string[] | null> {
  const byCategory = new Map<string, Item[]>();
  for (const item of options.items) {
    const group = byCategory.get(item.category) ?? [];
    group.push(item);
    byCategory.set(item.category, group);
  }

  const selectOptions = [...byCategory.entries()].flatMap(([category, items]) =>
    items.map((item) => ({
      hint: category,
      label: `${item.label}`,
      value: item.value,
    }))
  );

  const result = await multiselect({
    message: options.message,
    options: selectOptions,
    required: true,
  });

  if (isCancel(result)) {
    return null;
  }

  return result as string[];
}

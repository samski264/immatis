export const text = (value) => ({ content: [{ type: "text", text: value }] });

export function registerTools(tools) {
  const context = document.modelContext;
  if (!context?.registerTool) return () => {};

  const controller = new AbortController();
  for (const tool of tools) {
    Promise.resolve()
      .then(() => context.registerTool(tool, { signal: controller.signal }))
      .catch(() => {});
  }
  return () => controller.abort();
}

export function fileFromBase64({ data, mimeType, name }, index) {
  const bytes = Uint8Array.from(atob(data.replace(/^data:[^,]*,/, "")), (char) => char.charCodeAt(0));
  const extension = mimeType === "application/pdf" ? "pdf" : mimeType.split("/")[1];
  return new File([bytes], name || `volet-${index + 1}.${extension}`, { type: mimeType });
}

export async function safeReadJson(res: Response): Promise<{ ok: boolean; status: number; data: any | null }> {
  try {
    const text = await res.text();
    if (!text) return { ok: res.ok, status: res.status, data: null };
    return { ok: res.ok, status: res.status, data: JSON.parse(text) };
  } catch {
    return { ok: res.ok, status: res.status, data: null };
  }
}

import 'server-only';
import { getSupabase } from '@/lib/supabase/server';
import type { CatalogItem } from '@/lib/types';

let _cache: { items: CatalogItem[]; fetchedAt: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

export async function loadCatalog(opts?: { fresh?: boolean }): Promise<CatalogItem[]> {
    if (!opts?.fresh && _cache && Date.now() - _cache.fetchedAt < TTL_MS) {
        return _cache.items;
    }
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('line_items_catalog')
        .select('*')
        .eq('active', true)
        .order('category')
        .order('name');
    if (error) throw new Error(`loadCatalog failed: ${error.message}`);
    const items = (data ?? []) as CatalogItem[];
    _cache = { items, fetchedAt: Date.now() };
    return items;
}

import { getSupabaseClient } from './supabase';

const MAX_SHARE_BYTES = 700 * 1024;

export const SHARE_TOO_LARGE_ERROR = 'Share content exceeds the current size limit.';

export type ShareViewMode = 'split' | 'edit' | 'preview';

export type LoadShareResult =
  | { status: 'ready'; share: { markdown: string; viewMode: ShareViewMode } }
  | { status: 'not_found' | 'expired' };

const isShareViewMode = (value: unknown): value is ShareViewMode =>
  value === 'split' || value === 'edit' || value === 'preview';

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const getMarkdownSizeInBytes = (markdown: string): number => new TextEncoder().encode(markdown).length;

export const createShare = async (markdown: string, viewMode: ShareViewMode): Promise<string> => {
  if (getMarkdownSizeInBytes(markdown) > MAX_SHARE_BYTES) {
    throw new Error(SHARE_TOO_LARGE_ERROR);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('create_share', { markdown, view_mode: viewMode });

  if (error) {
    throw new Error(error.message);
  }

  if (typeof data !== 'string' || !isUuid(data)) {
    throw new Error('Failed to create share.');
  }

  return data;
};

export const loadShare = async (shareId: string): Promise<LoadShareResult> => {
  if (!isUuid(shareId)) {
    return { status: 'not_found' };
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('load_share', { share_id: shareId });

  if (error) {
    throw new Error(error.message);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row.status !== 'string') {
    return { status: 'not_found' };
  }

  if (row.status === 'ready') {
    return {
      status: 'ready',
      share: {
        markdown: typeof row.markdown === 'string' ? row.markdown : '',
        viewMode: isShareViewMode(row.view_mode) ? row.view_mode : 'preview',
      },
    };
  }

  if (row.status === 'expired') return { status: 'expired' };
  return { status: 'not_found' };
};

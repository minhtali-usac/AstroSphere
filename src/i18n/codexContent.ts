// Nội dung USACodex theo ngôn ngữ — chỉ phần tải lười của codex nhập tệp này.

import en from './codex.en.json';
import { LANG } from './locale';
import vi from './codex.vi.json';

export const content: typeof vi = LANG === 'en' ? en : vi;

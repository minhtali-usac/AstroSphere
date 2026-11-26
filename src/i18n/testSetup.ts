// Vitest: nạp sẵn bảng chuỗi tiếng Việt (trong ứng dụng, src/boot.ts làm việc này).
import dialogs from './dialogs.vi.json';
import { addStrings } from './index';
import vi from './vi.json';

addStrings(vi);
addStrings(dialogs);

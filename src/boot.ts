// Điểm vào của trang: nạp bảng chuỗi của ngôn ngữ đang dùng rồi mới nhập ứng dụng (nhiều mô-đun gọi t() ngay khi
// được nhập).

import './styles.css';
import { loadDictionary } from './i18n';

void loadDictionary().then(() => import('./main'));

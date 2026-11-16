# Thông báo về thành phần bên thứ ba

AstroSphere dùng dữ liệu và thư viện của các dự án dưới đây. Các thành phần này giữ nguyên giấy phép gốc của chúng;
giấy phép MIT trong `LICENSE` và CC BY-NC-SA 4.0 trong `LICENSE-CONTENT.md` không áp dụng cho chúng.

| Thành phần | Dùng ở đâu | Giấy phép |
|---|---|---|
| [d3-celestial](https://github.com/ofrohn/d3-celestial) (Olaf Frohn); dữ liệu sao gốc từ HYG Database | `src/data/generated/*.json`: danh mục sao, đường nối chòm sao, thiên thể sâu | BSD-3-Clause (toàn văn bên dưới) |
| [Natural Earth](https://www.naturalearthdata.com/) qua gói [world-atlas](https://github.com/topojson/world-atlas) | Đường bờ lục địa của bản đồ chọn vị trí | Phạm vi công cộng (dữ liệu); ISC (gói world-atlas) |
| Wikipedia tiếng Việt, bài «Danh sách chòm sao» | Tên chòm sao tiếng Việt | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.vi) |
| [Three.js](https://threejs.org/) | Đồ họa 3D | MIT |
| [KaTeX](https://katex.org/) | Hiển thị công thức | MIT |
| [astronomy-engine](https://github.com/cosinekitty/astronomy) | Chỉ dùng trong unit test để kiểm chứng phép tính | MIT |

## d3-celestial (BSD-3-Clause)

```
Copyright (c) 2015, Olaf Frohn
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

# Thông báo về thành phần bên thứ ba

AstroSphere dùng dữ liệu và thư viện của các dự án dưới đây. Các thành phần này giữ nguyên giấy phép gốc của chúng;
giấy phép MIT trong `LICENSE` và CC BY-NC-SA 4.0 trong `LICENSE-CONTENT.md` không áp dụng cho chúng.

| Thành phần | Dùng ở đâu | Giấy phép |
|---|---|---|
| [d3-celestial](https://github.com/ofrohn/d3-celestial) (Olaf Frohn); dữ liệu sao gốc từ HYG Database | `src/data/generated/*.json`: danh mục sao, đường nối chòm sao, thiên thể sâu | BSD-3-Clause (toàn văn bên dưới) |
| [Natural Earth](https://www.naturalearthdata.com/) qua gói [world-atlas](https://github.com/topojson/world-atlas) | Đường bờ lục địa của bản đồ chọn vị trí | Phạm vi công cộng (dữ liệu); ISC (gói world-atlas) |
| Wikipedia tiếng Việt, bài «Danh sách chòm sao» | Tên chòm sao tiếng Việt | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.vi) |
| Thị sai Hipparcos, bản xử lý mới (van Leeuwen 2007, A&A 474, 653; danh mục I/311), qua CDS VizieR | `src/data/fetched/hip-parallax.json`: khoảng cách sao cho chế độ «Bay vào vũ trụ» | Dữ liệu khoa học công khai; trích dẫn nguồn |
| NASA Exoplanet Archive, bảng Planetary Systems Composite Parameters (DOI 10.26133/NEA13) | `src/data/fetched/exoplanets.json`: ngoại hành tinh đã xác nhận | Dữ liệu công khai; lời ghi nhận bên dưới |
| JPL "Approximate Positions of the Planets" (Standish); Meeus, "Astronomical Algorithms", chương 47; NASA NSSDCA Planetary Fact Sheets; IAU WGCCRE 2015 | Vị trí và tính chất hành tinh, Mặt Trăng | Công thức và số liệu đã công bố; trích dẫn nguồn |
| [Three.js](https://threejs.org/) | Đồ họa 3D | MIT |
| [KaTeX](https://katex.org/) | Hiển thị công thức | MIT |
| [astronomy-engine](https://github.com/cosinekitty/astronomy) (Don Cross) | Vị trí Mặt Trời, Mặt Trăng và hành tinh trong «Bầu trời xưa» (gói tải lười `history`); kiểm chứng phép tính trong unit test | MIT |
| Espenak & Meeus, đa thức ΔT (NASA, *Five Millennium Canon of Solar Eclipses*), dựa trên Stephenson & Morrison 2004; Capitaine, Wallace & Chapront 2003 (tuế sai IAU 2006, IERS Conventions 2010 eq. 5.40); Laskar 1986 (độ nghiêng trục); Meeus, "Astronomical Algorithms", chương 7, 21, 22 | `src/astro/history.ts`: lịch, ΔT, tuế sai, độ nghiêng trục | Công thức và số liệu đã công bố; trích dẫn nguồn |
| Hipparcos, bản xử lý mới (van Leeuwen 2007; I/311): chuyển động riêng | `src/data/fetched/hip-motion.json` (khi có) và bảng chọn lọc trong `src/data/motion.ts` | Dữ liệu khoa học công khai; trích dẫn nguồn |
| [XEphem](https://github.com/XEphem/XEphem) (Elwood Downey) | Ý tưởng cho mục «Bầu trời xưa» (xem bầu trời ở thời điểm bất kỳ có tính tuế sai và chuyển động riêng). Không sao chép mã nguồn | MIT |

## NASA Exoplanet Archive

This research has made use of the NASA Exoplanet Archive, which is operated by the California Institute of Technology, under contract with the National Aeronautics and Space Administration under the Exoplanet Exploration Program.

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

# Route Lab — Thiết kế UI/UX

**Ngày:** 2026-07-31
**Phạm vi:** Frontend cho Lab 1 — Search Algorithms for Vietnamese Traffic Route Optimization
**Người phụ trách:** UI/UX và code frontend. Thuật toán do thành viên khác cài, giao tiếp qua FastAPI.

---

## 1. Bối cảnh

Đề bài yêu cầu ứng dụng tìm đường tối ưu trong giao thông đô thị Việt Nam. Nhóm chọn kịch bản **giao hàng tại TP.HCM**.

Tài liệu này mô tả giao diện, luồng tương tác, và hợp đồng dữ liệu frontend cần từ backend. Phần thuật toán không thuộc phạm vi ở đây.

## 2. Ràng buộc từ đề bài

Giao diện chịu trách nhiệm trực tiếp hoặc gián tiếp cho 35 trên 100 điểm:

| Hạng mục | Điểm | Giao diện phải làm gì |
|---|---:|---|
| Trực quan hoá quá trình tìm kiếm | 10 | Hiện từng bước: nút đã xét, hàng đợi biên, tuyến cuối |
| Giải thích tuyến và so sánh phương án | 10 | Đặt các phương án cạnh nhau, nói rõ vì sao chọn |
| Bối cảnh giao thông Việt Nam | 10 | Đường thật, địa danh thật, mức kẹt xe đọc được |
| Video demo | 5 | Giao diện phải quay lên hình dễ hiểu |

Đề bắt buộc cho chọn: điểm đầu, điểm đích, điểm trung gian, thuật toán, tiêu chí tối ưu. Phải hiện: tuyến đi, thứ tự ghé, số nút đã xét, tổng quãng đường, tổng thời gian, tổng chi phí, thời gian xử lý.

## 3. Quyết định đã chốt

**Mạng lưới dựng động từ OpenStreetMap.** Người dùng chọn điểm lấy hàng và điểm giao ở bất kỳ đâu, ứng dụng tải đường thật trong vùng bao quanh hai điểm đó rồi rút gọn thành đồ thị. Không có danh sách địa điểm cố định. Đây là dạng dữ liệu "simplified real-world" mà đề cho phép, và mạnh hơn nhiều so với đồ thị chép tay.

**Bản đồ: Leaflet, nền CARTO Positron.** Nhẹ, vẽ marker và polyline trực tiếp. Nền xám nhạt để mọi màu bão hoà trên màn hình đều là màu do ứng dụng vẽ ra. Không dùng Google Maps: tốn phí, và Directions API dễ gây hiểu lầm là nhóm không tự cài thuật toán.

**Stack:** Vite, React, TypeScript, Zustand, Leaflet. Không dùng thư viện lưới ngoài — kéo thả bằng HTML drag and drop, co giãn bằng `resize` của CSS.

**Chữ: IBM Plex Sans và IBM Plex Mono.** Cả hai có bộ tiếng Việt đầy đủ, dấu thanh đặt đúng chỗ.

## 4. Hai nguyên tắc thiết kế

**Giao diện không có màu, chỉ dữ liệu mới có màu.** Khung ứng dụng chỉ dùng trắng, xám và mực. Mọi sắc độ xuất hiện đều mang nghĩa: xanh sang đỏ là mức đông đúc, xanh lam là vùng thuật toán đã xét, mực đen là tuyến được chọn. Trong một công cụ so sánh, màu nào không mang nghĩa là màu gây nhiễu.

**Máy nói bằng chữ đơn cách, người nói bằng chữ thường.** Mọi con số, tên thuật toán, số bước đặt bằng IBM Plex Mono. Nhãn, câu hướng dẫn, mô tả đặt bằng IBM Plex Sans. Đọc lướt là biết ngay đâu là số liệu đo được, đâu là lời của giao diện.

Hệ quả quan trọng nhất: **thứ phân biệt các thuật toán không phải tuyến đi, mà là dấu chân khám phá.** UCS và A\* luôn trả cùng một tuyến vì cả hai đều tối ưu trên cùng hàm chi phí (UCS chính là Dijkstra nên không tách riêng làm hai thuật toán). Khác biệt nằm ở số nút phải xét và hình dạng vùng lan ra. Đo trên tuyến Bến Thành đến Landmark 81: UCS xét 263 nút, A\* xét 197, Greedy chỉ 79. Giao diện phải làm nổi bật quá trình, tuyến cuối chỉ là kết quả.

Vì vậy nút đã xét **nhạt dần theo thời gian** thay vì giữ nguyên độ đậm — người xem thấy được hướng lan, không chỉ vùng đã lan.

## 5. Kiến trúc màn hình

```
┌──────────────────────────────────────────────────────────────────┐
│ Route Lab · giao hàng TP.HCM   [Khung nhìn đang đồng bộ]  chú giải│
├──────────────┬───────────────────────────────────────────────────┤
│ HÀNH TRÌNH   │ ┌────────────────────┐ ┌────────────────────┐     │
│  Lấy  …      │ │ A*        bước 128 │ │ BFS       bước 128 │     │
│  Ghé  …      │ │ ┌────────────────┐ │ │ ┌────────────────┐ │     │
│  Giao …      │ │ │    BẢN ĐỒ      │ │ │ │    BẢN ĐỒ      │ │     │
│              │ │ └────────────────┘ │ │ └────────────────┘ │     │
│ MẠNG LƯỚI    │ │ 5.53 km  15 phút   │ │ 5.54 km  15 phút   │     │
│  Mức chi tiết│ └────────────────────┘ └────────────────────┘     │
│  [Dựng]      │ ┌────────────────────┐  ┌──────────────┐          │
│  483 nút     │ │ DFS       bước 128 │  │ Thêm màn hình│          │
│              │ └────────────────────┘  └──────────────┘          │
│ ĐIỀU KIỆN    │                                                    │
│  Khung giờ   │                                                    │
│  Phương tiện │                                                    │
│  Mạnh / Yếu  │                                                    │
│              │                                                    │
│ TIÊU CHÍ     │                                                    │
│ TRỌNG SỐ     ├───────────────────────────────────────────────────┤
│ [Chạy]       │ Lùi Chạy Tiến  Bước 128/263  ────●────  1x        │
└──────────────┴───────────────────────────────────────────────────┘
```

### Sidebar

Nguồn sự thật duy nhất cho truy vấn. Không màn hình nào được sửa các giá trị này. Đổi bất kỳ giá trị nào thì mọi màn hình đồng loạt xoá kết quả cũ và về trạng thái chưa chạy — không cho phép nửa màn hình hiện kết quả cũ, nửa kia hiện kết quả mới.

Năm nhóm: hành trình, mạng lưới đường, điều kiện, tiêu chí, trọng số.

Bốn thanh trượt trọng số đặt tên bằng tiếng Việt: quãng đường, thời gian, mức kẹt xe, rủi ro. Đề bắt buộc giải thích cách chọn trọng số; kéo thanh trước mặt người chấm rồi chỉ ra tuyến bẻ hướng thuyết phục hơn nhiều so với viết công thức trong báo cáo.

### Trạng thái khởi động

Lưới trống hoàn toàn. Không dựng sẵn màn hình nào, và chỉ có **một** lời mời thêm màn hình — ô gạch đứt chỉ xuất hiện khi lưới đã có ít nhất một màn hình. Nút chạy khoá cho tới khi có mạng lưới và có màn hình.

### Lưới bento

Mỗi màn hình là một bản đồ độc lập với danh sách thuật toán riêng, kéo tiêu đề để đổi vị trí, kéo góc để co giãn, nút đóng riêng. Giới hạn **5 màn hình**: quá số đó mỗi ô nhỏ hơn 300px thì bản đồ mất ý nghĩa.

Khung nhìn đồng bộ giữa mọi màn hình, tắt được bằng nút trên thanh trên khi cần soi kỹ một chỗ.

Màn hình thêm giữa chừng tự chạy ngay với truy vấn hiện tại, không bao giờ có ô lệch pha.

### Dòng thời gian chung

Một thanh duy nhất điều khiển tất cả. Kéo tới bước 128 thì mọi màn hình hiện trạng thái ở bước 128 của thuật toán của nó. Người xem thấy trực tiếp: cùng bước 128, A\* đã tới đích còn BFS vẫn đang loang. Màn hình xong sớm hiện nhãn *xong ở bước N* rồi đứng yên.

Cố ý **không** cho mỗi màn hình chạy tốc độ riêng — làm vậy là mất khả năng so sánh.

### Ba chế độ xem trong mỗi màn hình

Ba tab trên đầu mỗi ô, mỗi chế độ trả lời một câu hỏi khác nhau. Tab chứ không phải một nút xoay vòng: người dùng nhìn thấy cả ba lựa chọn và bấm thẳng vào cái mình muốn, không phải đoán còn mấy lần bấm nữa mới tới.

**Bản đồ** — nền CARTO thật, tên đường thật, cạnh tô theo mức kẹt xe. Trả lời "tuyến này né chỗ nào". Đây là chế độ giữ mười điểm bối cảnh giao thông Việt Nam.

**Sơ đồ** — bóc sạch nền bản đồ, chỉ còn lưới đường trên nền giấy, cạnh lùi về một sắc trung tính. Nền sạch thì màu duy nhất còn lại là màu của thuật toán, dấu chân khám phá nổi lên không còn gì tranh chấp.

**Cây** — trải cây tìm kiếm theo kiểu toả tròn. Mỗi nút được mở đều có một nút cha; tập các cặp cha–con ấy là một cây thật sự, và **hình dạng của cây chính là chân dung của thuật toán**. DFS ra chuỗi dài gần như không phân nhánh, BFS ra hình quạt toả đều theo lớp, A\* ra hình giọt nước lệch về phía đích, Greedy ra một nhánh gầy. Đặt bốn cây cạnh nhau là hiểu ngay khác biệt, không cần lời nào.

Dùng bố cục toả tròn theo độ sâu chứ không dùng mô phỏng lực đẩy: tính một lần là xong, luôn giống nhau giữa các lần chạy nên so sánh mới có nghĩa, và không tốn vòng lặp vật lý nào mỗi khung hình. Duyệt bằng ngăn xếp tường minh vì cây của DFS sâu tới hàng trăm tầng.

Khung nhìn lấy khung bao khít quanh các nút, không phải hình vuông theo bán kính lớn nhất — cây toả tròn hiếm khi phủ kín hình tròn, nhất là A\*, nên khung khít cho cây choán gấp bốn tới năm lần diện tích ô. Lăn chuột để phóng (0.6× đến 40×, điểm dưới con trỏ đứng yên), kéo để dời, bấm đúp để về vừa ô. Cỡ chấm và nét chia cho mức phóng nên giữ nguyên kích thước trên màn hình: phóng to là các nhánh tách nhau ra, không phải cả cây phình lên. Cỡ chấm đo theo khoảng cách giữa hai tầng — luôn bằng 1 — chứ không theo khung bao, vì khung bao của cây sâu rộng ra mà các tầng vẫn cách nhau đúng chừng ấy.

### Đồ thị mẫu tự thiết kế

Đề tách riêng phần giảng giải thuật toán và yêu cầu nhóm tự dựng ví dụ minh hoạ, không chép từ tutorial. Mạng lưới OpenStreetMap không dùng cho việc đó được: hàng trăm tới hàng nghìn nút, mã nút là chuỗi toạ độ, không ai dò bằng mắt nổi.

Nút **Đồ thị mẫu** nạp một đồ thị hai mươi nút ba mươi tư cạnh, mỗi nút mang một chữ cái và tên một địa điểm có thật ở TP.HCM. Vượt mức tối thiểu hai mươi nút ba mươi cạnh mà đề đặt ra, nên bộ này nộp kèm được luôn.

Các con số không đặt ngẫu nhiên. Đo trên tuyến A → J, xe máy, giờ cao điểm:

| Thuật toán | Nút đã xét | Quãng đường | Tuyến |
|---|---:|---:|---|
| BFS | 19 | 12.4 km | A→C→L→F→K→J |
| DFS | 9 | 21.8 km | A→O→N→M→K→J |
| UCS | 19 | 11.4 km | A→D→E→F→K→J |
| A\* | 11 | 11.4 km | A→D→E→F→K→J |
| Greedy | 7 | 13.1 km | A→D→E→G→H→K→J |

Năm thuật toán cho bốn tuyến khác nhau. Bốn loại xe cũng tách đôi: xe máy chui qua cụm kẹt E–F ở Hàng Xanh vì luồn được, còn xe van, ô tô và xe tải vòng hẳn qua Landmark 81.

Nút **Nhập file** nạp lại đồ thị từ JSON, nên nhóm sửa tay bộ dữ liệu rồi nạp lại được — đúng nghĩa "tự thiết kế".

## 6. Chọn địa điểm và dựng mạng lưới

Luồng ba bước, thay cho danh sách địa điểm cố định:

1. **Gõ tên địa điểm bất kỳ.** Ứng dụng tra Nominatim, giới hạn trong Việt Nam. Chờ người dùng ngừng gõ 350ms rồi mới hỏi, và huỷ lượt hỏi cũ khi có lượt mới.
2. **Dựng mạng lưới.** Gọi Overpass lấy toàn bộ đường trong khung bao quanh các điểm đã chọn, nới thêm 22% để thuật toán còn chỗ vòng tránh. Rút gọn: chỉ giữ nút giao, các đoạn thẳng ở giữa gộp thành một cạnh mang hình dạng thật của con đường. Giữ lại cụm đường liền mạch lớn nhất.
3. **Ghim.** Mỗi địa điểm quy về nút giao gần nhất, hiện rõ khoảng cách bằng mét.

Nhãn khoảng cách là bắt buộc, không phải trang trí: nó nói thật rằng thuật toán chạy trên nút giao chứ không phải trên cửa nhà, và biến giới hạn của mô hình thành thông tin minh bạch.

**Ba mức chi tiết** đổi được: trục chính, thêm đường vừa, cả đường nhỏ. Mức chi tiết quyết định kích thước đồ thị — đo trên tuyến Bến Thành đến Landmark 81: 483 nút ở mức thô, 679 ở mức vừa, 2241 ở mức chi tiết. Trên 900 nút thì giao diện cảnh báo hoạt ảnh sẽ dài và chậm.

Điều kiện giao thông của mỗi đoạn đường được mô phỏng từ cấp đường cộng nhiễu cố định theo mã tuyến: chạy lại bao nhiêu lần cũng ra cùng kết quả, nên so sánh mới có nghĩa.

Bản nộp nên đổi Nominatim sang **Goong** vì gợi ý địa chỉ tiếng Việt tốt hơn hẳn. Goong cần khoá API nên bản này dùng Nominatim để chạy được ngay; chỉ cần thay thân một hàm.

### Dựng nút giao: kiểm toán trên dữ liệu thật

Ba câu hỏi về cách dựng nút, trả lời bằng đo chứ không bằng suy luận. Vùng đo: khung bao Nhà thờ Đức Bà – Thảo Điền, 4.260 tuyến đường, 16.224 điểm.

**Định danh nút bằng gì.** Bản đầu làm tròn toạ độ tới năm chữ số (~1,1 m) rồi ghép chuỗi làm mã nút. Đo lại thì cách ấy đếm ra đúng **3.929 nút giao, bằng đúng số đếm bằng mã nút thật** — không sai một nút nào. Nhưng nó **gộp nhầm 17 cặp nút vốn tách rời**, tức dựng ra 17 lối đi không có thật, thường ở chỗ cầu vượt và đường bên dưới tình cờ trùng toạ độ. Overpass vốn đã trả kèm mảng `nodes`, nên chuyển sang dùng mã nút thật xoá sạch lớp lỗi ấy mà không tốn thêm gì. Toạ độ làm tròn giữ lại làm phương án dự phòng.

**Cấp đường bị bỏ sót.** Bản đầu chỉ hỏi sáu cấp đường chính, bỏ hết các nhánh `*_link` — đường dẫn lên xuống cầu vượt và nút giao khác mức. Thiếu chúng thì không có lối lên cũng không có lối xuống trục lớn:

| Mức chi tiết | Cụm liên thông mạnh (cũ) | Có thêm `*_link` |
|---|---:|---:|
| Trục chính | 438 / 664 — 66% | 580 / 857 — 68% |
| Đường vừa | 716 / 971 — 74% | **961 / 1135 — 85%** |
| Đường nhỏ | 4315 / 5040 — 86% | **4731 / 5169 — 92%** |

Vùng đo có 199 nhánh nối như vậy. Thêm chúng vào, tuyến Đức Bà – Thủ Thiêm đi từ 239 lên **437 nút**, điểm đến ghim từ 1260 m xuống **723 m**, và tuyến trả về từ 3,77 km lên **5,0 km** — sát thực tế hơn hẳn. `unclassified` và `living_street` cũng lấy kèm, quy về `residential`.

**Thẻ một chiều.** Bổ sung `oneway=-1` (chiều đi ngược thứ tự điểm — phải đảo cạnh, không phải bỏ qua), `oneway=true/1`, `junction=circular`, và quy ước ngầm rằng đường cao tốc mặc định một chiều. Đo trong vùng thì cả bốn trường hợp đều bằng không — dữ liệu Việt Nam không dùng chúng — nhưng xử lý đúng chỉ tốn một dòng nên vẫn làm.

### Cấm rẽ

Đo trước khi viết, vì không đáng dựng cả bộ máy cho một tập rỗng. Số quan hệ `type=restriction` trong dữ liệu OpenStreetMap:

| Vùng | Tuyến đường | Quan hệ cấm rẽ |
|---|---:|---:|
| TP.HCM mở rộng | 45.404 | 1.350 |
| Trung tâm Hà Nội | 3.861 | 487 — **12,6 trên mỗi 100 tuyến** |

Dữ liệu dày và đáng dùng. Khoảng 76% có `via` là một nút giao nên dùng được ngay; 24% có `via` là cả một tuyến đường, dành cho nút giao nhiều nhánh, cần mô hình khác hẳn nên bỏ qua — thà thiếu một lệnh cấm còn hơn dựng sai một lệnh.

Điều bất ngờ nằm ở cách người Việt gắn thẻ. Trong 757 quan hệ ở trung tâm TP.HCM, **491 dùng `restriction:conditional`** thay vì `restriction`, và **459 mang `except`**:

```
"restriction:conditional": "no_left_turn @ (06:00-09:00,16:00-19:00)"
"except": "motorcycle;bicycle;mofa;moped"
```

Nghĩa là: ô tô cấm rẽ trái giờ cao điểm, xe máy thì không. Đúng hai trục ứng dụng đã có sẵn — khung giờ và loại xe — nên biển cấm rẽ trở thành chỗ hai lựa chọn ấy gặp nhau.

Ứng dụng chỉ có ba khung giờ còn biển thì ghi giờ thật, nên mỗi khung lấy một **mốc giờ đại diện**: cao điểm 17:30, thấp điểm 13:00, ban đêm 22:00. Hỏi mốc ấy có nằm trong biển cấm không. Cách này cho kết quả dứt khoát và giải thích được bằng một câu, hơn hẳn so chồng lấn hai khoảng giờ — chồng lấn mười lăm phút cũng làm cả khung bị coi là cấm.

Đo trên tuyến Đức Bà – Landmark 81, mức "Đường nhỏ", 124 lệnh cấm rẽ đọc được (92 có khung giờ, 111 có miễn trừ):

| Xe | Cao điểm | Thấp điểm | Ban đêm |
|---|---:|---:|---:|
| Xe máy | 3 lần bị chặn | 3 | 3 |
| Ô tô con, xe van | **22** | 18 | 6 |
| Xe tải | 3 | 3 | 2 |

Xe máy gần như miễn nhiễm, ô tô lúc cao điểm bị chặn gấp bảy lần. Đó là điều ai đi đường Sài Gòn cũng biết, và giờ nó nằm trong dữ liệu chứ không phải trong lời kể.

**Nói thẳng một điều:** trên các tuyến đã đo, cấm rẽ **không** làm đổi tuyến cuối cùng — nó chặn những hướng mà tuyến rẻ nhất vốn không dùng tới. Giá trị của nó nằm ở chỗ mô hình đúng hơn và ở con số chênh lệch giữa các loại xe, chứ chưa phải ở kết quả tìm đường.

**Xấp xỉ, và xấp xỉ ở đâu.** Cấm rẽ ràng buộc trên **cặp** đoạn đường, trong khi thuật toán tìm kiếm trên đồ thị nút chỉ nhớ một nút cha cho mỗi nút. Cách xử lý ở đây vì thế là xấp xỉ: nó **không bao giờ sinh ra tuyến phạm luật**, nhưng có thể bỏ lỡ một tuyến hợp lệ rẻ hơn mà muốn đi thì phải vào nút ấy bằng hướng khác. Muốn đúng tuyệt đối phải tìm kiếm trên đồ thị cạnh, số trạng thái tăng theo bậc của mỗi nút.

Điều này cố tình **không** tính vào cột "tối ưu". Lượt chạy nào trên mạng lưới thật cũng gặp ít nhất một biển cấm rẽ ở đâu đó, nên gộp vào là mọi kết quả đều thành "xấp xỉ" và cột ấy mất sạch khả năng phân biệt UCS với Greedy — đúng thứ nó sinh ra để nói. Thay vào đó, số lần bị chặn hiện riêng ở chân ô, và khối giải thích nói rõ giới hạn.

### Khung giờ phải tác động qua mức kẹt, không qua tốc độ nền

Bản đầu nhân tốc độ nền theo khung giờ. Sai một cách kín đáo: nhân tốc độ thì nhân cho **mọi** loại xe như nhau, nên lợi thế luồn lách của xe máy thành một tỉ lệ cố định. Đo trên một ki-lô-mét đường trục:

| | Cao điểm | Thấp điểm |
|---|---:|---:|
| Xe máy, kẹt làm chậm | ×1,92 | ×1,92 |
| Ô tô, kẹt làm chậm | ×2,93 | ×2,93 |

Y hệt nhau. Tức mô hình nói hai giờ sáng xe máy vẫn hơn ô tô đúng ngần ấy phần trăm — chuyện không có thật.

Cái thay đổi theo giờ là **đường có kẹt hay không**. Nên khung giờ nhân vào phần kẹt (`peak 1,00 · offpeak 0,55 · night 0,18`), và tốc độ nền chỉnh lại cho đúng: xe máy 0,95, ô tô 1,10 — đường trống thì ô tô nhanh hơn.

| | Trước | Sau |
|---|---:|---:|
| Cao điểm | xe máy nhanh hơn 36% | 14% |
| Thấp điểm | 31% | 6% |
| Ban đêm | 31% | **0%** |

Trên 1 km đường thoáng: ô tô 1,70 phút, xe máy 1,97 — ô tô thắng. Trên 1 km kẹt 5/5 giờ cao điểm: ô tô 5,00, xe máy 3,80 — xe máy thắng. Lợi thế đảo chiều đúng chỗ nó phải đảo, và thang "Tốc độ" trong giao diện tự đổi theo vì nó suy ra từ chính hệ số.

### Mức chi tiết thứ tư: Cả hẻm

Mạng hẻm là thứ làm shipper xe máy Việt Nam khác mọi phương tiện khác, và bản đầu **không có nó**. Đếm trong vùng trung tâm TP.HCM:

| Cấp đường | Số tuyến | |
|---|---:|---|
| `service` | 5794 | không nạp — trong đó **4345 là `service=alley`**, tức hẻm |
| `residential` | 2414 | đang nạp |

Cái ứng dụng gọi là "đường nhỏ" thực ra là đường khu dân cư, ô tô vào bình thường — nên xe máy chẳng có lợi thế riêng nào. Đo trước khi sửa: ô tô đi đúng 0,5 km "đường nhỏ" y như xe máy, chênh lệch thời gian hoàn toàn do hệ số kẹt.

Dữ liệu còn nói rõ ô tô vào được hay không: trong 4345 hẻm, 27% ghi `motorcar=destination` và 10% ghi `motorcar=no`. Mô hình: `service=alley` thành một cấp đường riêng `alley`, chỉ xe máy đi được; hẻm nào ghi `motorcar=yes` thì coi như đường khu dân cư (đo được đúng một tuyến).

Hẻm phải hỏi bằng mệnh đề Overpass riêng, và phải lọc đúng `service=alley` — lấy cả `service` là vơ luôn lối vào bãi đỗ và đường dẫn vào nhà, những thứ không nối đi đâu cả.

Đo trên quãng 1,5 km trong Quận 1–Quận 3:

| | Mức "Đường nhỏ" | Mức "Cả hẻm" |
|---|---|---|
| Đồ thị | 946 nút, 2030 cạnh | **2793 nút, 6480 cạnh** (3343 cạnh hẻm, 129 km) |
| Xe máy | 2,15 km · 9 phút | **2,09 km** · 9 phút · có 0,1 km hẻm |
| Ô tô, xe van | 2,15 km · 11 phút — **cùng tuyến** | **2,36 km** · 12 phút — **tuyến khác** |

Trước khi sửa, cả ba xe đi chung một đường. Sau khi sửa, xe máy có tuyến riêng và ngắn hơn 11%, vì đúng lý do thật.

Cái giá: đồ thị nặng gấp ba, tải mất ~21 giây. Nên hạn mức của mức này đặt rất chặt (hành lang 1,4 km, diện tích 14 km²), chỉ chạy được với quãng dưới khoảng 3 km, và nó **không bao giờ được tự chọn giúp** khi mức khác bị đứt đoạn — phải là quyết định của người dùng.

### Bảng so sánh phương tiện

Lưới màn hình so sánh **thuật toán**: mỗi ô một thuật toán, cùng một hành trình. Loại xe thì ngược lại — nó là lựa chọn chung của cả lưới, nên muốn biết xe tải đi khác xe máy chỗ nào thì phải bấm đổi xe rồi tự nhớ lấy con số cũ. Không so được.

Khối **So sánh phương tiện** dưới phần giải thích chạy cả bốn xe một lượt, giữ nguyên thuật toán, khung giờ và trọng số đang đặt. Cột: quãng đường, thời gian, chi phí, số cạnh bị cấm, số lần cấm rẽ chặn, khoảng ghim xa nhất, và một chữ cái nhóm tuyến — cùng chữ nghĩa là đi trùng đường.

Không thể chỉ đổi `vehicle` rồi chạy lại bốn lần, vì **mỗi loại xe ghim vào một nút giao khác nhau**: chỗ xe máy dừng được chưa chắc xe tải rời đi được. Bảng tự ghim lại cho từng xe; thiếu bước đó là so hai thứ khác nhau.

Chỉ tính khi người dùng mở ra. Mỗi lần tính là bốn lượt tìm kiếm đầy đủ — đo trên 1701 nút mất 19–34 ms, đủ nhanh khi bấm nhưng để chạy nền theo mỗi cái nhích thanh trượt thì giao diện sẽ giật.

Đo trên Đức Bà – Landmark 81, A*, mức Đường nhỏ:

| Xe | Cao điểm | Thấp điểm | Cạnh bị cấm (cao điểm → thấp điểm) |
|---|---|---|---|
| Xe máy | 4,75 km · 14 phút | 4,75 km · 11 phút | 0 |
| Xe van, ô tô | 4,75 km · 22 phút | 4,75 km · 16 phút | 0 |
| Xe tải | **4,54 km** · 29 phút | **4,08 km** · 20 phút | 2951 → 2184 |

Ba xe đầu đi trùng đường, chỉ khác thời gian. Xe tải đi tuyến riêng, và tuyến ấy còn đổi theo khung giờ.

### Trọng số bằng 0 hết

Kéo cả bốn thanh về 0 thì hàm chi phí trả về 0 cho mọi đoạn đường, nên mọi tuyến đều có chi phí bằng nhau. Đo trên đồ thị mẫu:

| | Cân bằng | Bốn trọng số đều 0 |
|---|---|---|
| UCS | 11,4 km · TỐI ƯU | **20,7 km · vẫn TỐI ƯU** |
| A\* | 11,4 km · xét 11 nút | 20,7 km · xét 10 nút, y hệt UCS |
| Greedy | 13,1 km · xét 7 nút | 20,7 km · y hệt UCS |

Về mặt toán học không câu nào sai: tuyến 20,7 km thật sự có chi phí nhỏ nhất, vì mọi tuyến đều bằng 0. A\* thoái hoá vì ước lượng nhân với chi phí thấp nhất mỗi ki-lô-mét, mà số đó cũng bằng 0 nên h = 0. Nhưng người dùng đọc chữ "tối ưu" bên cạnh một tuyến vòng vèo thì chỉ kết luận là ứng dụng hỏng.

Xử lý: `costIsFlat` phát hiện trường hợp này, bỏ dấu "tối ưu" ở cả năm thuật toán, hiện cảnh báo ngay dưới bốn thanh trượt, và khối giải thích nói rõ nguyên nhân thay vì lời khẳng định tối ưu thường lệ. Không chặn người dùng — họ vẫn kéo được về 0 nếu muốn xem điều gì xảy ra.

### Giờ cấm tải

Xe tải trước đây bị cấm cả `residential` lẫn `tertiary` suốt ngày, tức 75% số cạnh ở mức chi tiết cao. Quá tay: xe tải nhẹ giao hàng vẫn đi được đường nhánh, chỉ không vào nổi hẻm.

Cái chặn thật ở nội thành không phải cấp đường mà là **giờ cấm tải** — một ràng buộc theo giờ. Nên tách làm hai:

- Cấm suốt ngày: chỉ `residential`.
- Giờ cấm tải, chỉ khung cao điểm: thêm `tertiary` và `secondary`.

Xe van được miễn hoàn toàn — đó chính là lý do thật khiến các hãng giao hàng ở Việt Nam dùng xe van.

Kết quả đo trên cùng tuyến: xe tải đi **4,54 km lúc cao điểm** nhưng **4,08 km lúc thấp điểm và ban đêm**. Khung giờ giờ không chỉ đổi tốc độ, nó đổi cả mạng lưới đi được. Vì vậy đổi khung giờ cũng phải ghim lại điểm như đổi xe: chỗ xe tải đỗ được lúc trưa có thể không rời đi được lúc cao điểm.

**Vẫn chưa mô hình hoá:** cấm rẽ có `via` là tuyến đường, hạn chế theo tải trọng (`maxweight`), và phân vùng cấm tải theo địa giới hành chính. Nói rõ ra để không ai tưởng là đã có.

### Khác biệt giữa các loại xe chỉ hiện ở mức "Đường nhỏ"

Đo tuyến Đức Bà – Landmark 81, cùng một điểm đi và điểm đến:

| Mức | Xe máy | Xe van | Ô tô con | Xe tải |
|---|---|---|---|---|
| Đường vừa | 3,71 km · 11 phút | 3,71 km · 16 phút | 3,71 km · 16 phút | 3,71 km · 25 phút |
| Đường nhỏ | 4,75 km · 14 phút | 4,75 km · 22 phút | 4,75 km · 22 phút | **3,71 km** · 25 phút |

Ở mức "Đường vừa" cả bốn xe đi **cùng một tuyến**, chỉ khác thời gian và chi phí. Lý do thì hợp lẽ: mức ấy chỉ có `trunk`, `primary`, `secondary`, mà xe máy chỉ bị cấm cao tốc còn xe tải chỉ bị cấm `residential` và `tertiary` — không cấp nào trong số đó có mặt, nên **không cạnh nào bị cấm cho bất kỳ xe nào**.

Ở mức "Đường nhỏ", xe tải bị cấm 2712/3598 cạnh và buộc phải bám trục lớn, ra một tuyến khác hẳn. Vậy nên khi quay video minh hoạ khác biệt giữa các loại xe, phải dùng **đồ thị mẫu hoặc mức "Đường nhỏ"** — ở mức "Đường vừa" thì khác biệt chỉ nằm ở thời gian, không nằm ở đường đi.

### Cụm giữ lại phải liên thông mạnh

Mạng lưới tải về luôn có những mẩu rời, nên chỉ giữ lại một cụm. Cụm ấy phải **liên thông mạnh** — đi xuôi chiều từ nút nào cũng tới được mọi nút còn lại — chứ không phải liên thông theo nghĩa bỏ chiều đi mà xét.

Đường một chiều làm hai khái niệm đó khác hẳn nhau, và ở Việt Nam khoảng cách ấy rất lớn. Đo thẳng trên dữ liệu Overpass quanh trung tâm Sài Gòn: **1414 trên 1931 tuyến đường mang thẻ `oneway=yes`, tức 73%**, chủ yếu vì đại lộ có dải phân cách được vẽ thành hai tuyến một chiều song song.

Hậu quả khi xét liên thông vô hướng, đo trên tuyến Nhà thờ Đức Bà đến Thủ Thiêm ở mức "đường vừa":

| Cách đo | Số nút giữ lại | Từ điểm xuất phát đi xuôi chiều tới được |
|---|---:|---:|
| Liên thông vô hướng (cũ) | 506 | 374 / 506 — 132 nút không đường nào dẫn tới |
| Liên thông mạnh (nay) | 239 | 239 / 239 |

Bản cũ dựng mạng lưới **báo thành công**, ghim hai điểm cách 83 m và 142 m, rồi thuật toán mới báo không tới được — và lời giải thích đổ oan cho mạng lưới đứt đoạn trong khi đường vẫn nối, chỉ là ngược chiều. Đây là kiểu lỗi tệ nhất: mọi dấu hiệu đều nói ổn cho tới bước cuối.

Dùng Kosaraju, duyệt bằng ngăn xếp tường minh vì mạng lưới có hàng nghìn nút. Đo lại bốn tuyến sau khi sửa, tất cả đều tới được 100% số nút và đều tìm ra đường.

Cái giá phải trả: cụm nhỏ đi nên có điểm bị ghim xa hơn — Thủ Thiêm từ 723 m lên 1260 m, vì đường trong đó phần lớn là nhánh cụt một chiều. Đổi lại, hai điểm bất kỳ trong mạng lưới đã giữ đều chắc chắn đi tới nhau được, nên di chuyển điểm đi và điểm đến không cần dựng lại mạng lưới.

## 7. Phương tiện giao hàng

Bốn loại xe, mỗi loại mạnh yếu khác nhau, nên cùng hai điểm vẫn ra tuyến khác nhau. Đây là chỗ bài toán mang tính Việt Nam rõ nhất — shipper xe máy và xe tải thực tế không đi cùng đường.

| Xe | Mạnh | Yếu |
|---|---|---|
| Xe máy | Luồn được khi kẹt, vào được đường nhỏ | Cấm cao tốc, chở ít, rủi ro cao hơn |
| Xe van | Đi được mọi cấp đường, cân bằng nhất | Không nhanh hơn ai ở điều kiện nào |
| Ô tô con | Nhanh trên trục lớn, an toàn | Kẹt là chịu chết, không luồn được |
| Xe tải | Chở được khối lượng lớn nhất | Cấm đường nhỏ và hẻm, chậm, phạt nặng đoạn rủi ro |

Mô hình hoá bằng ba hệ số: nhân tốc độ, mức chịu ảnh hưởng của kẹt xe, hệ số rủi ro — cộng danh sách cấp đường bị cấm.

**Đổi xe phải ghim lại điểm.** Chỗ xe máy dừng được chưa chắc xe tải vào được. Thiếu bước này thì chọn xe tải là mọi tuyến báo không tới được, dù đường lớn ngay bên cạnh. Đo thực tế: xe máy ghim cách 59m vào một con hẻm, xe tải phải ghim ra đường lớn cách 92m và đi tuyến dài hơn nhưng lớn hơn.

### Khi không có tuyến

Ghim đúng rồi vẫn có thể không tới được — một khu chỉ nối vào mạng lưới qua đường cao tốc thì xe máy chịu, dù mạng lưới liền mạch. "Không tới được" đứng một mình chỉ nói rằng hỏng, không nói phải làm gì tiếp, mà hai nguyên nhân của nó lại đòi hai cách xử lý trái ngược: mạng lưới đứt đoạn thì phải dựng lại, còn xe bị cấm thì mạng lưới vẫn tốt, chỉ cần đổi xe.

Phân biệt được hai trường hợp chỉ tốn hai lượt duyệt theo chiều rộng — một lượt bỏ hết ràng buộc, một lượt cho từng loại xe còn lại — nên cứ nói thẳng ra:

> Xe máy không qua được: mọi đường nối hai điểm đều phải đi qua đường cao tốc, mà xe máy bị cấm ở đó. Đổi sang xe van hoặc ô tô con hoặc xe tải thì đi được.

Kèm hai quy tắc về cách báo số:

- **Không có tuyến thì không có gì để tối ưu.** `metrics.optimal` phải xét cả `found`, không chỉ đọc tính chất lý thuyết của thuật toán. Trước đây chỗ này đóng dấu "TỐI ƯU" lên một kết quả rỗng, ngay cạnh dòng "không tới được".
- **Không hiện số không giả.** Quãng đường, thời gian và chi phí bằng không không phải vì tuyến ngắn mà vì chẳng có tuyến nào. Chân ô chỉ giữ hai con số có thật: đã xét bao nhiêu nút và mất bao lâu trước khi bỏ cuộc.

Cùng lẽ ấy, `order` chỉ liệt kê những điểm thật sự ghé được: chặng nào tắc thì các điểm sau nó chưa hề tới, kể tên chúng ra là nói sai.

## 8. Hàm chi phí

```
chi phí = w₁·quãng đường + w₂·thời gian + w₃·kẹt xe·quãng đường + w₄·rủi ro·quãng đường
```

Phần kẹt xe và rủi ro **nhân với chiều dài**, không cộng thẳng một cục. Ba trăm mét kẹt cứng không thể tính bằng ba ki-lô-mét kẹt cứng, mà mạng lưới lấy từ OpenStreetMap có rất nhiều đoạn chỉ vài chục mét — cộng cục sẽ phạt oan tuyến nào đi qua nhiều nút giao.

Nhân theo chiều dài còn cho một lợi ích thứ hai: mọi thành phần đều tỉ lệ với quãng đường, nên cận dưới mà A\* dùng để ước lượng trở nên sát. Trước khi sửa, A\* xét 516 nút so với 546 của UCS — gần như vô ích. Sau khi sửa, 197 so với 263.

**Ước lượng của A\*** là khoảng cách đường chim bay nhân với chi phí thấp nhất trên mỗi ki-lô-mét trong toàn mạng lưới. Cách này vẫn không bao giờ nói quá nên A\* giữ được tính tối ưu, nhưng chặt hơn nhiều so với dùng thẳng số ki-lô-mét. **Người viết thuật toán phải dùng đúng công thức này**, nếu không số liệu hai bên sẽ không khớp.

## 9. Ngôn ngữ thị giác

**Xung đột màu.** Hai hệ thông tin cùng nằm trên đường: mức kẹt xe của từng đoạn, và tuyến thuật toán chọn. Tách theo chất liệu chứ không theo màu:

- **Nền đường thể hiện mức kẹt xe**, thang xanh lá sang đỏ theo mức 1–5, nét mảnh, hơi mờ. Luôn hiện kể cả khi chưa chạy.
- **Tuyến được chọn vẽ bằng mực đen**, viền trắng dày bọc ngoài, lõi đen chạy trong. Mực nằm ngoài mọi thang màu dữ liệu nên không thể nhầm, và đọc như một nét bút vạch lên bản đồ: điều kiện của thành phố là màu, quyết định của thuật toán là mực.

**Trạng thái nút** phân biệt bằng cả màu lẫn kích thước:

| Trạng thái | Hình | Ý nghĩa |
|---|---|---|
| Chưa chạm | chấm xám nhỏ | thuật toán chưa biết tới |
| Trong hàng đợi biên | vòng tròn rỗng viền xanh nhạt | đang chờ được xét |
| Đã xét | chấm xanh lam đặc, nhạt dần theo thời gian | đã xét xong |
| Đang xét | vòng tròn lớn viền xanh đậm | tiêu điểm của bước hiện tại |

Điểm lấy hàng, điểm ghé và điểm giao phân biệt bằng **hình dạng** chứ không thêm màu mới: tròn, thoi, vuông.

**Không dùng biểu tượng.** Nút bấm ghi chữ: Lùi, Chạy, Tiến, Đóng, Xoá. Trong một giao diện đo đạc, chữ nói chính xác hơn hình.

## 10. Mô hình state

Ba khối, lý do các màn hình không bao giờ lệch nhau:

```ts
truy vấn : { start, goal, stops[], detail, period, vehicle, criterion, weights }
màn hình : { id, algo, result }[]
thời gian: { step, playing, speed, maxStep }
```

Màn hình **không** giữ bản sao của truy vấn.

Trace lưu nút bằng **chỉ số** thay vì mã chuỗi: một lượt chạy trên mạng lưới vài trăm nút sinh ra hàng chục nghìn phần tử hàng đợi, nhân với năm màn hình thì lưu chuỗi sẽ ngốn bộ nhớ vô ích.

## 11. Hợp đồng API

**Trạng thái hiện tại: frontend tự tính hết, chưa gọi backend.**

Bản đang chạy dựng đồ thị bằng `lib/overpass.ts` và chạy cả năm thuật toán bằng
`lib/search.ts`, toàn bộ trong trình duyệt. Không có một lời gọi nào tới backend.
Đây là lựa chọn có chủ đích để frontend không bị chặn, nhưng phải nói thẳng ra
trong tài liệu, vì bản trước của mục này mô tả như thể việc nối đã xong — ai đọc
mà cài backend theo rồi ráp vào sẽ thấy không chạy.

Khi nối, chỉ cần thay thân hai hàm: `buildGraph` gọi `GET /api/graph`, và
`planRoute` gọi `POST /api/search/batch`. Phần còn lại của ứng dụng không đổi.

```
GET  /api/graph?points=lat,lng;lat,lng&detail=coarse|medium|fine
  → { nodes: [{ id, lat, lng }],
      edges: [{ from, to, km, roadClass, congestion, risk, name, shape }] }

POST /api/search/batch
  ← { start, goal, stops[], algorithms[], vehicle, period, weights, optimiseOrder }
  → { nodeIds: [...],
      results: [{ algo, order[], path[], found, problem?, metrics, trace[] }] }
```

**Ba điều bắt buộc, thiếu một cái là phần trực quan hoá vỡ:**

**1. `nodeIds` là bắt buộc, và thứ tự phải cố định.** Đây là mảng mã nút, dùng
làm bảng tra cho `trace`. Bản trước của tài liệu quên hẳn trường này. Mỗi bước
trong `trace` lưu nút bằng **chỉ số trong `nodeIds`**, không phải mã nút, vì một
lượt chạy trên mạng lưới vài trăm nút sinh ra hàng chục nghìn phần tử hàng đợi —
nhân với năm màn hình thì lưu chuỗi sẽ ngốn bộ nhớ vô ích. Thứ tự `nodeIds` phải
trùng khớp thứ tự mảng `nodes` mà `GET /api/graph` trả về, và phải giữ nguyên
suốt phiên làm việc.

**2. Tên trường là `algo`, không phải `algorithm`.** Bản trước ghi `algorithm`;
mã nguồn dùng `algo`. Chọn `algo` để khỏi phải sửa frontend.

**3. `trace` không được rỗng.** Đây là điểm dễ vỡ nhất của cả dự án: backend rất
hay chỉ trả tuyến cuối rồi quên trace, mà thiếu trace thì toàn bộ phần trực quan
hoá từng bước — mười điểm trong bảng chấm — không tồn tại.

`metrics` gồm: `km`, `minutes`, `cost`, `expanded`, `ms`, `optimal`.

`trace` là mảng các bước:
```json
{ "expanded": 412, "frontier": [128, 96, 431], "g": 4.21, "h": 3.08 }
```
Với thuật toán không dùng ước lượng, `h` trả `null`; giao diện tự ẩn.

`problem` là câu giải thích khi truy vấn tự nó vô nghĩa — ví dụ điểm đi và điểm
đến ghim vào cùng một nút giao. Có trường này thì giao diện nói được lý do thay
vì hiện "xong ở bước 0, tối ưu" trông như bị treo.

Một request `batch` phục vụ cả năm màn hình, để mọi màn hình nhận kết quả cùng
lúc và dòng thời gian chung khởi động đồng bộ.

## 12. Bài toán nhiều điểm giao

Dùng chung lưới bento, không tách tab riêng.

Mỗi màn hình chạy thuật toán của nó lần lượt qua từng chặng rồi nối các trace thành một dòng thời gian duy nhất. Chặng nào tới nơi thì đoạn đó hiện ra ngay — tuyến được xây dần từng khúc.

Tuỳ chọn *tự sắp thứ tự ghé* dùng heuristic láng giềng gần nhất, đo bằng chi phí UCS thật giữa các cặp điểm. Đây là lời giải **xấp xỉ**, và ô số liệu phải ghi rõ điều đó — đề bắt buộc nêu rõ thuật toán cho kết quả tối ưu hay gần đúng.

Đo thực tế với hai điểm giao thêm: tự sắp thứ tự cho 9.79 km, giữ thứ tự nhập tay cho 10.97 km. Chênh 11%.

## 13. Rủi ro kỹ thuật

**Leaflet vẽ hỏng khi khung chứa đổi kích thước.** Bắt buộc gọi `invalidateSize()` sau mỗi lần co giãn màn hình, qua `ResizeObserver` đặt trên từng khung bản đồ. Không xử lý là bản đồ vỡ ngay lần co giãn đầu tiên.

**Vòng lặp vô hạn khi đồng bộ khung nhìn.** Màn hình A phát sự kiện di chuyển sang B, B phát ngược lại A. Cần một cờ chặn ở tầng ứng dụng.

**Vẽ lại quá nhiều.** Mỗi bước có thể phải cập nhật vài nghìn nút. Hai biện pháp: dùng canvas thay cho SVG, và chỉ đổi kiểu cho nút thật sự đổi trạng thái — hiệu ứng nhạt dần chia làm bốn nấc thay vì liên tục, để phần lớn nút không đổi nấc ở mỗi bước.

**Overpass từ chối User-Agent mặc định của Node** bằng mã 406. Trình duyệt không bị vì luôn gửi User-Agent thật. Chỉ ảnh hưởng khi chạy kiểm thử ngoài trình duyệt.

**Overpass có lúc chậm.** Đo được từ 1.7 giây tới 8.7 giây cho cùng một truy vấn. Phải có trạng thái đang tải rõ ràng và thông báo lỗi nói được cách khắc phục.

## 14. Thứ tự cắt phạm vi nếu thiếu thời gian

Cắt từ dưới lên:

1. Bốn mức tuỳ chỉnh trọng số (giữ bốn nút tiêu chí định sẵn)
2. Kéo thả đổi vị trí màn hình (giữ co giãn)
3. Ba mức chi tiết mạng lưới (chốt cứng một mức)
4. Điểm giao trung gian — **không cắt được**, đề bắt buộc bài toán nhiều điểm

Phần lõi không đụng tới: lưới nhiều màn hình, chọn thuật toán theo màn hình, dòng thời gian chung, trạng thái nút, bảng số liệu.

## 15. Câu hỏi còn mở

- Bản nộp có đổi sang Goong không? Cần một người đăng ký khoá API.
- Có làm giao diện tối không? Hiện giả định **không**; cân nhắc lại nếu quay video trong phòng tối.
- Có cần chạy trên điện thoại không? Giả định **không** — lưới nhiều màn hình vốn là giao diện cho màn hình rộng.

# Tài liệu Xác nhận Yêu cầu — Client Clarification & Sign-off

**Loại tài liệu:** Chuẩn bị xác nhận khách hàng (Client Clarification + Sign-off Preparation). **Đây không phải là tài liệu triển khai.** Không có thay đổi code, database, hay cấu hình nào được thực hiện để tạo ra tài liệu này.

**Ngày:** 2026-08-25
**Nguồn yêu cầu gốc:** `He_thong_quan_ly_du_hoc_hoc_bong.xlsx` (đọc trực tiếp từ file Excel gốc, tất cả các sheet liên quan)
**Tài liệu tham chiếu:** `CLIENT_ACCEPTANCE_MATRIX.md`, `CLIENT_ACCEPTANCE_REPORT.md`, `CLIENT_ACCEPTANCE_REAUDIT_ROUND2.md`, `CLIENT_REQUIREMENTS_GAPS.md`, `CLIENT_REQUIREMENT_CONFLICTS.md`

---

## 1. Mục đích

Hệ thống hiện đang ở trạng thái **PASS WITH CONDITIONS** (Chấp nhận có điều kiện) sau vòng rà soát thứ hai (Re-Audit Round 2). Một số điểm trong yêu cầu gốc **không thể tự giải quyết bằng suy đoán kỹ thuật** — cần khách hàng xác nhận trực tiếp trước khi đội ngũ kỹ thuật thực hiện bất kỳ thay đổi nào. Tài liệu này tổng hợp toàn bộ các điểm đó thành một gói quyết định (decision pack) để khách hàng xem xét và ký xác nhận.

Tài liệu này **không đề xuất coi các điều kiện đang mở là đã hoàn tất**, và **không tự chọn cách hiểu cuối cùng** cho bất kỳ điểm mâu thuẫn nào — mỗi điểm đều đi kèm các phương án cụ thể để khách hàng lựa chọn.

## 2. Trạng thái chấp nhận hiện tại

| Chỉ số | Giá trị |
|---|---|
| Tổng số yêu cầu | 131 (đã cập nhật 2026-08-25, thêm 1 dòng mới REQ-STUDENT-008) |
| Đã triển khai đầy đủ (IMPLEMENTED) | 95 (đã cập nhật 2026-08-25) |
| Triển khai một phần (PARTIAL) | 18 (đã cập nhật 2026-08-25) |
| Chưa triển khai (MISSING) | 8 (đã cập nhật 2026-08-25) |
| Triển khai sai yêu cầu (INCORRECT) | 6 |
| Không thể kiểm chứng trong môi trường hiện tại (NOT_TESTABLE) | 1 |
| Mâu thuẫn cần khách hàng quyết định (CONFLICT) | 4 — đã giải quyết hoàn toàn: CONFLICT-004 (2026-08-25), CONFLICT-003 (2026-08-27); đã giải quyết một phần: CONFLICT-001 (ngưỡng thanh toán, 2026-08-27 — câu hỏi riêng về PAYMENT/AMENDED làm giá trị enum vẫn mở); còn mở hoàn toàn: CONFLICT-002 |
| Yêu cầu bắt buộc (mandatory) | 114 |
| Lỗi nghiêm trọng (CRITICAL) còn tồn đọng | 0 |
| Lỗi mức cao (HIGH) còn tồn đọng | ~~1 (đã cập nhật 2026-08-26 — xem đính chính bên dưới)~~ **0 (2026-08-27 — DEC-09 giải quyết phát hiện HIGH cuối cùng, xem đính chính bên dưới)** |
| **Kết quả chấp nhận** | **PASS WITH CONDITIONS** |

**ĐÍNH CHÍNH (2026-08-25):** Bảng trên đã được cập nhật so với số liệu gốc của Round 2 (130 yêu cầu; 91 IMPLEMENTED, 20 PARTIAL, 9 MISSING, 4 HIGH tồn đọng) qua ba bước. Thứ nhất: mục 8 bên dưới ("Trường/Lớp") — vốn được Round 2 xem là một khoảng trống HIGH hoàn toàn chưa xây dựng — thực chất đã tồn tại sẵn trên `AcademicRecord`, không phải một lỗi thực sự. Thứ hai: khách hàng đã trực tiếp xác nhận (2026-08-25) rằng việc chặn các trường bắt buộc của Student ở bước phê duyệt Assessment (không phải lúc tạo hồ sơ) đúng là thiết kế có chủ đích, và chốt Quyết định 04 (GPA): Optional — xem mục 7. Thứ ba: khách hàng yêu cầu sửa luôn mã nguồn cho 3 điểm này (bao gồm cả field "Giải thưởng" cho Activity) — đã hoàn tất, xem mục 7/8 và ghi chú "Code fixes applied" tại `CLIENT_ACCEPTANCE_MATRIX.md`/`CLIENT_ACCEPTANCE_REPORT.md`. Một lượt rà soát lại toàn bộ 18 trường dữ liệu của sheet04 (yêu cầu của khách hàng, thực hiện sau khi sửa code) không phát hiện thêm khoảng trống nào khác trong Student Profile.

**ĐÍNH CHÍNH (2026-08-26):** Khách hàng đã chốt cả 3 quyết định DEC-06/07/08 (mục 9, Đóng hồ sơ/Thanh lý) và yêu cầu triển khai — đã hoàn tất. HIGH tồn đọng giảm từ 2 xuống còn **1** (chỉ còn Quyết định 09 — liên kết Hoa hồng↔Visa, mục 10, chưa liên quan tới Đóng hồ sơ). Chi tiết đầy đủ: mục 9 bên dưới (đính chính đầu mục) và `docs/requirements/CLOSURE_LIQUIDATION_DESIGN.md`.

**ĐÍNH CHÍNH (2026-08-27):** Khách hàng đã chốt Quyết định 09 (mục 10, liên kết Hoa hồng↔Visa) — bắt buộc cho hoa hồng phát sinh từ Visa, đã triển khai `CommissionTransaction.visaId` và kiểm thử đầy đủ. **HIGH tồn đọng giảm từ 1 xuống còn 0** — đây là phát hiện HIGH cuối cùng trong toàn bộ đợt nghiệm thu. Xem `CLIENT_ACCEPTANCE_REPORT.md` để biết kết luận nghiệm thu tổng thể đã được đánh giá lại như thế nào.

**ĐÍNH CHÍNH (2026-08-27):** Khách hàng chốt thêm 2 quyết định. **DEC-01** (mục 4, ngưỡng thanh toán kích hoạt hợp đồng): tối thiểu 30% giá trị hợp đồng, đã sửa code và kiểm thử đầy đủ (backend e2e/unit, frontend). **DEC-03** (mục 6, phạm vi truy cập dữ liệu Đối tác): không giới hạn theo case — hành vi hiện tại đã đúng ý định, không cần sửa code. CONFLICT-003 nay RESOLVED hoàn toàn; CONFLICT-001 resolved một phần (chỉ còn câu hỏi riêng về PAYMENT/AMENDED làm giá trị `ContractStatus` — xem `CLIENT_REQUIREMENT_CONFLICTS.md`).

Tài liệu này **không** tìm cách chuyển "PASS WITH CONDITIONS" thành "PASS" bằng suy đoán. Việc chuyển trạng thái chỉ có thể xảy ra sau khi khách hàng xác nhận các quyết định dưới đây và đội kỹ thuật thực hiện đúng theo lựa chọn đó.

## 3. Vì sao cần khách hàng xác nhận

Trong quá trình rà soát, đội ngũ phát hiện một số điểm mà **văn bản yêu cầu gốc (file Excel) không đủ rõ ràng, hoặc chính file Excel tự mâu thuẫn với chính nó** giữa các sheet khác nhau. Đây không phải lỗi kỹ thuật — đây là các quyết định nghiệp vụ (business decision) chỉ khách hàng mới có thẩm quyền trả lời. Đội kỹ thuật đã cố tình **không tự suy đoán** các điểm này để tránh xây dựng sai hướng, phải sửa lại sau này, hoặc — nghiêm trọng hơn — xây đúng theo suy đoán nhưng sai với ý định thực sự của khách hàng.

---

## 4. Quyết định 01 — Ngưỡng thanh toán để kích hoạt hợp đồng (CONFLICT-001) — **ĐÃ QUYẾT ĐỊNH 2026-08-27**

**YÊU CẦU KHÁCH HÀNG (trích nguyên văn):**
Sheet `11_Quan_ly_hop_dong`, dòng 9-10: giai đoạn "Thanh toán" (theo dõi số tiền, hạn thanh toán, đã thu, còn nợ — người phụ trách: HCTH) nằm ngay trước giai đoạn "Kích hoạt dịch vụ" (tự động mở case — người phụ trách: Hệ thống, trạng thái ACTIVE).

**SHEET NGUỒN:** `11_Quan_ly_hop_dong`, dòng 9-10.

**TRIỂN KHAI HIỆN TẠI:** Hợp đồng chỉ được chuyển sang trạng thái "Đang hoạt động" (ACTIVE) sau khi hệ thống ghi nhận **ít nhất một khoản thanh toán** (không phân biệt số tiền lớn hay nhỏ). Việc kích hoạt hiện do nhân viên chủ động thực hiện (không tự động 100% như văn bản mô tả).

**QUYẾT ĐỊNH/GIẢ ĐỊNH HIỆN TẠI:** Đây là một lựa chọn kỹ thuật tạm thời (đã ghi nhận trong hồ sơ nội bộ), chưa được khách hàng xác nhận là đúng ý định.

**MÂU THUẪN CHÍNH XÁC:** Văn bản yêu cầu không nêu rõ số tiền/tỷ lệ cụ thể cần thu được trước khi kích hoạt dịch vụ — chỉ nói "theo dõi đã thu/còn nợ." Hệ thống hiện đang hiểu là "chỉ cần có bất kỳ khoản thanh toán nào" là đủ điều kiện.

**ẢNH HƯỞNG NGHIỆP VỤ:** Nếu khách hàng thực sự muốn yêu cầu một khoản đặt cọc cụ thể (ví dụ: 30%, hoặc đợt đầu tiên) trước khi mở dịch vụ cho học sinh, thì cách hiểu hiện tại ("có thanh toán bất kỳ là đủ") có thể cho phép mở dịch vụ sớm hơn ý định thực sự, gây rủi ro tài chính.

**ẢNH HƯỞNG BẢO MẬT:** Không đáng kể — đây thuần túy là ngưỡng nghiệp vụ, không liên quan đến quyền truy cập.

**ẢNH HƯỞNG DỮ LIỆU:** Không cần thay đổi cấu trúc dữ liệu dù chọn phương án nào — chỉ là thay đổi điều kiện kiểm tra.

**ẢNH HƯỞNG QUY TRÌNH:** Ảnh hưởng trực tiếp đến thời điểm case được mở và đội tư vấn bắt đầu làm việc với học sinh.

**CÁC PHƯƠNG ÁN ĐỀ XUẤT:**
- **Phương án A:** Giữ nguyên như hiện tại — chỉ cần có bất kỳ khoản thanh toán nào được ghi nhận là đủ điều kiện kích hoạt.
- **Phương án B:** Yêu cầu một tỷ lệ/số tiền cụ thể (ví dụ: đặt cọc tối thiểu X% hoặc đợt thanh toán đầu tiên) trước khi kích hoạt.
- **Phương án C:** Yêu cầu thanh toán đầy đủ 100% trước khi kích hoạt.

**PHƯƠNG ÁN ĐỀ XUẤT:** Phương án A (giữ nguyên).
**LÝ DO:** Đây là cách hiểu an toàn nhất hiện đã được xây dựng và kiểm thử đầy đủ; việc đổi sang B hoặc C chỉ là một thay đổi nhỏ về điều kiện kiểm tra, không ảnh hưởng kiến trúc hệ thống, nên có thể điều chỉnh sau nếu khách hàng chọn khác.

**KHÁCH HÀNG CẦN QUYẾT ĐỊNH:** ~~CÓ~~ **Đã quyết định.**

---

**KHÁCH HÀNG CHỐT (2026-08-27):** Phương án B — yêu cầu tối thiểu **30% giá trị hợp đồng** đã thanh toán trước khi kích hoạt (SIGNED → ACTIVE). Thanh toán dưới 30% chưa đủ điều kiện kích hoạt.

**ĐÃ TRIỂN KHAI:** `ContractsService.updateStatus` (`apps/api/src/modules/commercial/contracts/contracts.service.ts`) — hằng số `ACTIVATION_PAYMENT_THRESHOLD_RATIO = 0.3`. Điều kiện kiểm tra tổng số tiền đã thu thực tế trên hợp đồng (tổng `paidAmount - refundedAmount` của mọi Payment thuộc hợp đồng, trừ đi số đã hoàn) so với 30% giá trị hợp đồng (`Contract.value`), không phải chỉ đếm số lượng khoản thanh toán như trước. Vẫn giữ nguyên mã lỗi `PAYMENT_REQUIRED_FOR_ACTIVATION` (409) để không phá vỡ hợp đồng API hiện có, chỉ đổi điều kiện và nội dung thông báo. Gợi ý trên giao diện (`ContractStatusDialog`) và bảng ánh xạ lỗi (`error-messages.ts`) đã cập nhật để nói rõ ngưỡng 30%.

**KIỂM THỬ:** Đã cập nhật/thêm test trong `apps/api/test/contracts.e2e-spec.ts` (dưới 30% bị từ chối, đúng 30% được chấp nhận, cộng dồn nhiều khoản thanh toán tới 30% được chấp nhận) và điều chỉnh 2 test trong `payments.e2e-spec.ts` có số tiền thanh toán cũ (dưới 30%) để không bị lỗi do thay đổi ngưỡng.

**KHÔNG THAY ĐỔI:** Câu hỏi riêng về việc có cần đưa PAYMENT/AMENDED thành giá trị `ContractStatus` thật hay không (phần "mô hình hoá" của CONFLICT-001) — vẫn để ngỏ, chưa được hỏi trong quyết định này.

## 5. Quyết định 02 — Vai trò Quản trị hệ thống (SYSTEM_ADMIN) (CONFLICT-002)

**YÊU CẦU KHÁCH HÀNG (trích nguyên văn):**
Sheet `02_Phan_quyen` liệt kê chính xác **7 vai trò nghiệp vụ**: Giám đốc điều hành, Trưởng phòng, Nhân viên tư vấn, Nhân viên xử lý hồ sơ, Sale/Marketing, HCTH, Học sinh/PHHS. Không có vai trò thứ 8 nào được nêu.

**SHEET NGUỒN:** `02_Phan_quyen`, toàn bộ.

**TRIỂN KHAI HIỆN TẠI:** Hệ thống có thêm một vai trò kỹ thuật (SYSTEM_ADMIN) không nằm trong danh sách trên — vai trò này **không có quyền truy cập bất kỳ dữ liệu nghiệp vụ nào** (không xem học sinh, hợp đồng, thanh toán...), chỉ dùng để quản lý tài khoản người dùng, xem nhật ký hệ thống (audit log), và theo dõi các tác vụ nền kỹ thuật.

**QUYẾT ĐỊNH/GIẢ ĐỊNH HIỆN TẠI:** Chưa có văn bản nào ghi nhận việc khách hàng đã xem và chấp thuận sự tồn tại của vai trò này.

**MÂU THUẪN CHÍNH XÁC:** Văn bản yêu cầu liệt kê đúng 7 vai trò nghiệp vụ nhưng không đề cập đến vai trò vận hành/kỹ thuật (IT admin) — không rõ đây là một thiếu sót trong yêu cầu, hay khách hàng chủ động không muốn có vai trò này.

**ẢNH HƯỞNG NGHIỆP VỤ:** Thấp — vai trò này không chạm vào dữ liệu học sinh/hợp đồng/tài chính.

**ẢNH HƯỞNG BẢO MẬT:** Thấp — phạm vi quyền hạn hẹp, chỉ phục vụ vận hành hệ thống.

**ẢNH HƯỞNG DỮ LIỆU:** Không có.

**ẢNH HƯỞNG QUY TRÌNH:** Không có — vai trò này không tham gia vào bất kỳ quy trình nghiệp vụ nào (Lead→Contract→...→Closure).

**CÁC PHƯƠNG ÁN ĐỀ XUẤT:**
- **Phương án A:** Giữ nguyên vai trò này với phạm vi hẹp như hiện tại (chỉ quản trị kỹ thuật, không dữ liệu nghiệp vụ), chính thức ghi nhận là vai trò thứ 8 ngoài danh sách nghiệp vụ.
- **Phương án B:** Xóa vai trò này, chuyển các chức năng quản trị kỹ thuật hẹp sang cho Giám đốc điều hành.
- **Phương án C:** Giữ vai trò nhưng đổi tên/định nghĩa lại để khách hàng dễ hiểu đây không phải một vai trò nghiệp vụ.

**PHƯƠNG ÁN ĐỀ XUẤT:** Phương án A hoặc C (không cần thay đổi hệ thống, chỉ cần xác nhận bằng văn bản).
**LÝ DO:** Vai trò này không có quyền truy cập dữ liệu nghiệp vụ nào, nên không có rủi ro bảo mật — hợp lý hơn nếu ghi nhận rõ ràng bằng văn bản thay vì gỡ bỏ và phải tìm ai đó khác quản lý các việc vận hành kỹ thuật (tạo tài khoản, theo dõi lỗi hệ thống...).

**KHÁCH HÀNG CẦN QUYẾT ĐỊNH:** CÓ (chỉ là xác nhận bằng văn bản, không yêu cầu thay đổi hệ thống nếu chọn A/C).

---

## 6. Quyết định 03 — Phạm vi truy cập dữ liệu Đối tác (CONFLICT-003) — **ĐÃ QUYẾT ĐỊNH 2026-08-27**

**YÊU CẦU KHÁCH HÀNG (trích nguyên văn):**
Sheet `09_Account_Security`, dòng 18: "Đối tác chỉ xem dữ liệu được chia sẻ theo từng case."

**SHEET NGUỒN:** `09_Account_Security`, dòng 18.

**TRIỂN KHAI HIỆN TẠI:** Hệ thống hiện tại **chưa có** cổng đăng nhập riêng cho đối tác bên ngoài (Đối tác không tự đăng nhập vào hệ thống). Nhân viên nội bộ có quyền xem dữ liệu đối tác thì thấy **toàn bộ danh sách đối tác**, không lọc theo case cụ thể.

**QUYẾT ĐỊNH/GIẢ ĐỊNH HIỆN TẠI:** Chưa có ghi nhận nào làm rõ cách hiểu đúng của câu yêu cầu này.

**MÂU THUẪN CHÍNH XÁC:** Câu yêu cầu có thể hiểu theo hai cách hoàn toàn khác nhau:
1. Nói về việc **đối tác bên ngoài** (nếu sau này có cổng đăng nhập riêng cho đối tác) chỉ được xem dữ liệu case liên quan đến họ — hiện tại không áp dụng vì chưa có cổng như vậy.
2. Nói về việc **nhân viên nội bộ** khi xem thông tin đối tác chỉ nên thấy các đối tác liên quan đến case mình đang phụ trách, không phải toàn bộ danh sách đối tác của công ty.

**ẢNH HƯỞNG NGHIỆP VỤ:** Nếu cách hiểu (2) là đúng, nhân viên hiện đang thấy nhiều thông tin đối tác hơn mức cần thiết cho công việc của họ (dù vẫn trong phạm vi vai trò được cấp quyền).

**ẢNH HƯỞNG BẢO MẬT:** Trung bình nếu cách hiểu (2) đúng — đây không phải rò rỉ dữ liệu ra ngoài trái phép (chỉ nhân viên đã được cấp quyền xem đối tác mới thấy), mà là mức độ chi tiết truy cập nội bộ rộng hơn cần thiết.

**ẢNH HƯỞNG DỮ LIỆU:** Nếu chọn lọc theo case, cần thêm logic liên kết đối tác với case cụ thể khi hiển thị danh sách.

**ẢNH HƯỞNG QUY TRÌNH:** Nếu lọc quá chặt, có thể gây bất tiện cho nhân viên cần tra cứu thông tin đối tác chung (ví dụ: tìm đối tác mới cho một case).

**CÁC PHƯƠNG ÁN ĐỀ XUẤT:**
- **Phương án A:** Xác nhận đây là yêu cầu dành cho cổng đối tác bên ngoài (chưa xây dựng) — hiện tại không cần thay đổi gì, chỉ cần áp dụng khi/nếu xây cổng đối tác trong tương lai.
- **Phương án B:** Xác nhận đây là yêu cầu lọc nội bộ theo case — cần bổ sung logic lọc danh sách đối tác theo case đang phụ trách.
- **Phương án C:** Không cần lọc gì cả — đối tác là dữ liệu dùng chung giữa các case (ví dụ: một trường đại học có thể liên quan đến nhiều học sinh/case khác nhau), nên toàn bộ nhân viên có quyền xem đối tác nên thấy toàn bộ danh sách.

**PHƯƠNG ÁN ĐỀ XUẤT:** Không đủ cơ sở để đề xuất một phương án cụ thể — đây là quyết định nghiệp vụ thuần túy phụ thuộc vào ý định ban đầu của khách hàng.
**LÝ DO:** Không xác định được từ văn bản hiện có.

**KHÁCH HÀNG CẦN QUYẾT ĐỊNH:** ~~CÓ~~ **Đã quyết định.**

---

**KHÁCH HÀNG CHỐT (2026-08-27):** Phương án C — không giới hạn Partner theo Case. Nguyên văn: *"Không cần giới hạn Partner theo Case. Partner là dữ liệu đối tác chung của công ty; nhân viên có quyền partners:view được xem Partner theo phạm vi toàn công ty. Các dữ liệu/hoạt động nhạy cảm của Partner vẫn được kiểm soát bằng permission và field-level access."*

**KẾT LUẬN:** Hành vi hiện tại (`PartnersService.list/getById` không lọc theo case, chỉ gác cổng bằng quyền `partners:view`) **đã đúng ý định khách hàng** — không cần sửa code. Câu yêu cầu gốc "chỉ xem dữ liệu chia sẻ theo case" (sheet09 dòng 18) được xác nhận là nói về **cổng đối tác bên ngoài** (chưa xây dựng), không áp dụng cho nhân viên nội bộ xem dữ liệu Partner.

**ĐÃ CẬP NHẬT:** `CLIENT_ACCEPTANCE_MATRIX.md` (REQ-SEC-017, REQ-PARTNER-006, REQ-RBAC-011, REQ-ID-017 — tất cả chuyển từ PARTIAL/CONFLICT/NOT_APPLICABLE sang IMPLEMENTED, xác nhận đúng thiết kế), `CLIENT_REQUIREMENTS_GAPS.md` (GAP-019 đóng — không còn là gap), `CLIENT_REQUIREMENT_CONFLICTS.md` (CONFLICT-003 RESOLVED).

**LƯU Ý:** Quyết định này không thay đổi phạm vi kiểm soát các dữ liệu/hoạt động nhạy cảm khác của Partner (ví dụ: PartnerDocument, CommissionRule/CommissionTransaction) — những phần đó tiếp tục được kiểm soát bằng permission theo module và field-level access như hiện tại, không liên quan đến quyết định về scope-theo-case.

---

## 7. Quyết định 04 — Yêu cầu bắt buộc của điểm GPA (CONFLICT-004) — **ĐÃ QUYẾT ĐỊNH 2026-08-25**

**QUYẾT ĐỊNH CỦA KHÁCH HÀNG (2026-08-25):** Chọn **Phương án B** — GPA là **tùy chọn (Optional)**, theo sheet17. Đội kỹ thuật đề xuất Phương án A/C ở dưới đã **không** được chọn; nội dung gốc bên dưới được giữ nguyên làm hồ sơ đề xuất ban đầu, không xóa bỏ. Quyết định này phát hiện ra một điểm chưa khớp thực sự trong mã nguồn: `assertStudentProfileComplete` khi đó vẫn đang chặn phê duyệt Assessment nếu thiếu GPA — tức là mã nguồn vẫn đang xử lý GPA như bắt buộc, mâu thuẫn với quyết định tùy chọn vừa chốt. Ghi nhận là phát hiện **GAP-027** trong `CLIENT_REQUIREMENTS_GAPS.md`. **Đã sửa code 2026-08-25 (theo yêu cầu tiếp theo của khách hàng):** bỏ điều kiện `gpa: { not: null }` khỏi cổng kiểm tra, chỉ còn giữ `grade: { not: null }` — `assessment-roadmap.e2e-spec.ts` (20/20 test pass) đã xác nhận. Rà soát lại toàn bộ 18 trường dữ liệu sheet04 sau khi sửa không phát hiện thêm vấn đề nào khác. Xem chi tiết đầy đủ tại `CLIENT_REQUIREMENT_CONFLICTS.md` mục CONFLICT-004 (đã cập nhật) và `CLIENT_ACCEPTANCE_MATRIX.md` mục "CODE FIXES APPLIED (2026-08-25)".

---

**YÊU CẦU KHÁCH HÀNG (trích nguyên văn, hai sheet mâu thuẫn nhau):**
- Sheet `04_Student_Profile`, dòng 6: "GPA | GPA theo năm/kỳ | Tư vấn cập nhật | **Bắt buộc**"
- Sheet `17_Data_Dictionary`, dòng 7: "Student | gpa | Decimal | | Staff | **Optional**"

**SHEET NGUỒN:** `04_Student_Profile` dòng 6 và `17_Data_Dictionary` dòng 7.

**TRIỂN KHAI HIỆN TẠI:** Hệ thống hiện đang yêu cầu GPA phải có trước khi một Assessment (đánh giá năng lực) được phê duyệt — tức là đi theo cách hiểu "Bắt buộc" của sheet04.

**QUYẾT ĐỊNH/GIẢ ĐỊNH HIỆN TẠI:** Đội kỹ thuật chọn cách hiểu chặt hơn (Bắt buộc) làm phương án an toàn tạm thời, không phải quyết định cuối cùng của khách hàng.

**MÂU THUẪN CHÍNH XÁC:** Hai sheet trong cùng một file Excel gốc của khách hàng ghi nhận **ngược nhau** về cùng một trường dữ liệu.

**ẢNH HƯỞNG NGHIỆP VỤ:** Nếu khách hàng thực sự muốn GPA là tùy chọn (theo sheet17), thì hệ thống hiện tại đang chặn một số học sinh tiến hành Assessment nếu chưa có GPA — có thể gây bất tiện không cần thiết cho các trường hợp học sinh chưa có bảng điểm GPA chính thức (ví dụ: học sinh mới, hệ thống điểm khác).

**ẢNH HƯỞNG BẢO MẬT:** Không có.

**ẢNH HƯỞNG DỮ LIỆU:** Không cần thay đổi cấu trúc dữ liệu — chỉ là thay đổi điều kiện kiểm tra.

**ẢNH HƯỞNG QUY TRÌNH:** Ảnh hưởng đến việc một case có thể tiến vào giai đoạn Roadmap hay không nếu thiếu GPA.

**CÁC PHƯƠNG ÁN ĐỀ XUẤT:**
- **Phương án A:** Giữ GPA là bắt buộc (theo sheet04, đã triển khai).
- **Phương án B:** Đổi GPA thành tùy chọn (theo sheet17).
- **Phương án C:** GPA bắt buộc để phê duyệt Assessment, nhưng cho phép tạo hồ sơ học sinh (Student) mà chưa cần GPA — giữ nguyên như cách hệ thống đang hoạt động thực tế (GPA chỉ chặn ở bước Assessment, không chặn khi tạo học sinh mới).

**PHƯƠNG ÁN ĐỀ XUẤT:** Phương án A hoặc C.
**LÝ DO:** Sheet Student Profile (sheet04) là sheet mô tả yêu cầu nghiệp vụ trực tiếp, có ngữ cảnh rõ ràng hơn ("GPA theo năm/kỳ"); sheet Data Dictionary (sheet17) là bảng kỹ thuật tổng quát, nhiều khả năng là lỗi đánh máy hoặc chưa cập nhật. Nên đề xuất khách hàng xác nhận sửa lại sheet17 cho khớp, thay vì nới lỏng yêu cầu nghiệp vụ.

**KHÁCH HÀNG CẦN QUYẾT ĐỊNH:** ~~CÓ~~ **ĐÃ QUYẾT ĐỊNH 2026-08-25 — xem đầu mục 7 ở trên (chọn Phương án B, không phải A/C đề xuất).**

---

## 8. Trường thông tin "Trường/Lớp" của học sinh (Student.school) — Yêu cầu mới phát hiện, mức độ HIGH — **ĐÃ QUYẾT ĐỊNH 2026-08-27 (câu hỏi 3, 4)**

**ĐÍNH CHÍNH (2026-08-25) — xin đọc trước khi dùng phần "TRẠNG THÁI HIỆN TẠI" bên dưới:** Nhận định "hoàn toàn chưa được xây dựng" bên dưới là **kết luận sai của đợt Re-Audit Round 2**, không phải một lỗi thực sự của hệ thống. Kiểm tra lại vào 2026-08-25 phát hiện trường `school` đã tồn tại trên bảng `AcademicRecord` (không phải trên bảng `Student`) — bắt buộc ở cả tầng cơ sở dữ liệu (NOT NULL, chặt hơn cả `grade`/`gpa`), tầng DTO (`create-academic-record.dto.ts`), và tầng giao diện nhập liệu (`academic-record-dialog.tsx`, ô bắt buộc). Round 2 trước đó chỉ tìm trong `model Student` mà không kiểm tra `model AcademicRecord` — nơi `grade`/`gpa` (đã được Round 2 công nhận là có triển khai) cũng đang được lưu. Theo đúng nguyên tắc của dự án là "không viết đè lịch sử," toàn bộ nội dung gốc bên dưới được giữ nguyên làm hồ sơ những gì Round 2 từng kết luận; phần đính chính này bổ sung thông tin đúng hiện tại. Hệ quả với các câu hỏi cần làm rõ bên dưới:
- **Câu hỏi 1** (một trường hay hai trường) — đã có câu trả lời từ chính hệ thống hiện tại: `school` (bắt buộc) và `grade` (tùy theo giai đoạn) đã được lưu như hai trường riêng biệt trên `AcademicRecord`, đúng theo cách sheet17 mô tả.
- **Câu hỏi 4** (gắn với Student hay Academic Record) — cũng đã có câu trả lời: hệ thống hiện đang lưu `school` theo từng năm học trên `AcademicRecord`, khác với đề xuất ban đầu của sheet17 (gắn trực tiếp vào Student, không lặp theo năm). Đây là điểm khách hàng cần xác nhận có chấp nhận được không, chứ không còn là một khoảng trống cần xây mới.
- **Câu hỏi 2** (giai đoạn nào thì bắt buộc) — **đã được khách hàng xác nhận 2026-08-25**: chặn ở bước phê duyệt Assessment (không phải ngay lúc tạo hồ sơ) đúng là thiết kế có chủ đích, áp dụng chung cho cả 6 trường bắt buộc còn lại của Student (ngày sinh, quốc gia/ngành/intake/học bổng mục tiêu) lẫn `school`. Không còn là câu hỏi mở — không cần thay đổi mã nguồn.
- **Câu hỏi 3** (nhập tự do hay chọn từ danh sách) vẫn còn để ngỏ — chưa có quyết định từ khách hàng.
- Mục "MÔ HÌNH DỮ LIỆU ĐỀ XUẤT" và "KHÁCH HÀNG CẦN XÁC NHẬN: CÓ" bên dưới không còn là đề xuất xây mới — không cần thay đổi mã nguồn. Xem chi tiết đầy đủ tại `CLIENT_ACCEPTANCE_MATRIX.md` mục "POST-ROUND-2 CORRECTION (2026-08-25)" và mục GAP-022 (đã RESOLVED) trong `CLIENT_REQUIREMENTS_GAPS.md`.

---

**TRẠNG THÁI HIỆN TẠI (nội dung gốc của Round 2, xem đính chính ở trên):** Trường thông tin này **hoàn toàn chưa được xây dựng** trong hệ thống — không có chỗ lưu trữ, không có ô nhập liệu trên form, không có kiểm tra bắt buộc nào. Đây là một khoảng trống thực sự, không phải vấn đề về thời điểm bắt buộc như các trường khác.

**YÊU CẦU KHÁCH HÀNG (trích nguyên văn):**
- Sheet `04_Student_Profile`, dòng 5: "Trường/Lớp | Thông tin học tập hiện tại | Tư vấn cập nhật | **Bắt buộc**"
- Sheet `17_Data_Dictionary`, dòng 5: "Student | school | String | | Staff | **Required** | Tư vấn/Hồ sơ; HS chính mình |"

Hai sheet đồng thuận trường này là bắt buộc — **không có mâu thuẫn** ở điểm này, khác với GPA ở Quyết định 04.

**CÁC CÂU HỎI CẦN LÀM RÕ:**

1. **"Trường/Lớp" là một trường hay hai trường?** Sheet04 gộp chung "Trường" (tên trường) và "Lớp" (lớp/khối) thành một dòng duy nhất. Nhưng sheet17 (Data Dictionary) lại tách thành hai trường riêng: `school` (Bắt buộc) và `grade` (**Tùy chọn**, không bắt buộc). Trường `grade` (lớp/khối) đã được xây dựng trong hệ thống rồi (không phải trường mới) — trường thực sự còn thiếu chỉ là `school` (tên trường). **Not established from current requirements**: liệu khách hàng có thực sự muốn "lớp/khối" là tùy chọn trong khi "trường" là bắt buộc, như sheet17 mô tả, hay cả hai đều nên bắt buộc như dòng gộp chung của sheet04 ngụ ý.
2. **Ở giai đoạn nào thì bắt buộc?** *Not established from current requirements* — văn bản không nêu rõ trường này cần có ngay khi tạo hồ sơ học sinh, hay chỉ cần có trước một mốc nào đó trong quy trình (tương tự như 7 trường bắt buộc khác của học sinh, hiện đang được kiểm tra ở bước phê duyệt Assessment).
3. **Nhập tự do hay chọn từ danh sách trường có sẵn?** *Not established from current requirements* — sheet17 chỉ ghi kiểu dữ liệu là "String" (chuỗi văn bản), gợi ý nhập tự do, nhưng không loại trừ khả năng khách hàng muốn một danh sách trường chuẩn để chọn.
4. **Gắn với hồ sơ học sinh (Student) hay hồ sơ học tập theo năm (Academic Record)?** Theo sheet17, trường `school` được đặt trực tiếp trên bảng Student (không lặp lại theo từng năm học), khác với `grade`/`gpa` vốn đã được hệ thống lưu theo từng năm học (vì một học sinh có thể đổi trường/lớp qua các năm). **Not established from current requirements**: khách hàng có muốn lưu lịch sử trường học qua các năm, hay chỉ cần trường hiện tại là đủ?

**MÔ HÌNH DỮ LIỆU ĐỀ XUẤT (chỉ là đề xuất, chưa triển khai):** Thêm trường "Trường học hiện tại" trực tiếp vào hồ sơ học sinh (không lặp theo năm), dạng văn bản tự do, theo đúng cách sheet17 mô tả và theo mẫu đã dùng cho trường "Mục tiêu học bổng" (đã xây dựng gần đây theo cách tương tự).

**GIAI ĐOẠN KIỂM TRA BẮT BUỘC ĐỀ XUẤT:** Cùng thời điểm với 7 trường bắt buộc khác của học sinh hiện đang được kiểm tra (trước khi phê duyệt Assessment) — để nhất quán, nhưng vẫn phụ thuộc vào câu trả lời chung cho câu hỏi "giai đoạn nào" đã nêu ở các mục trước.

**KHÁCH HÀNG CẦN XÁC NHẬN:** ~~CÓ~~ **Đã quyết định (câu hỏi 3, 4).**

---

**KHÁCH HÀNG CHỐT (2026-08-27) — câu hỏi 4 (lưu theo năm hay trực tiếp trên Student):**
**Theo từng năm học.** Xác nhận giữ nguyên thiết kế hiện tại (`school` trên `AcademicRecord`,
một dòng mỗi kỳ/năm học) thay vì đề xuất ban đầu của sheet17 (một trường duy nhất trực tiếp
trên Student). Khách hàng cũng xác nhận rõ: **không được ghi đè lịch sử** — sửa một kỳ chỉ
được cập nhật đúng dòng của kỳ đó, không được làm mất dữ liệu các kỳ trước. Đây chính là hành
vi hệ thống đã có sẵn từ trước (`AcademicRecordsService.create/update`, xem mục 8 phần đính
chính 2026-08-25) — không cần sửa code cho phần này.

**KHÁCH HÀNG CHỐT (2026-08-27) — câu hỏi 3 (nhập tự do hay chọn từ danh sách):**
**Cả hai, kết hợp:** ưu tiên chọn từ danh sách "School Master" (danh mục trường do nhân viên
quản lý), nhưng vẫn cho phép nhập tự do khi trường chưa có trong danh mục. **Đã triển khai
2026-08-27:** model mới `SchoolMaster` (tối giản, không có mã định danh riêng — không phải
định dạng ID do khách hàng yêu cầu ở sheet18/20), liên kết tùy chọn từ `AcademicRecord` qua
`schoolMasterId`; khi chọn từ danh mục, `school` được hệ thống tự điền từ tên bản ghi Master
(không tin dữ liệu client gửi lên, tránh lệch dữ liệu); khi không chọn, `school` vẫn là văn
bản tự do như trước. Quyền quản lý danh mục (`school_master:create/edit`) chỉ dành cho Giám
đốc điều hành/Trưởng phòng, theo đúng quy ước "master-data curation chỉ ED/DM" đã áp dụng cho
`admission_master`/`visa_checklist_templates`; Tư vấn/Hồ sơ chỉ có quyền xem/chọn. Đã kiểm thử
đầy đủ: backend unit 209/209, backend e2e 552/552 (thêm 6 test mới), frontend 325/325,
typecheck/lint sạch cả hai phía. Xem `docs/DECISIONS.md` mục ghi quyết định thiết kế và
`docs/security/RBAC_MATRIX.md` §2 cho bảng quyền đầy đủ.

---

## 9. Đóng hồ sơ / Thanh lý hợp đồng (Closure/Liquidation) — Vấn đề thiết kế nghiệp vụ, không chỉ là thiếu giao diện

**QUYẾT ĐỊNH CỦA KHÁCH HÀNG (2026-08-26):** Cả 3 quyết định DEC-06/07/08 bên dưới đã được khách hàng chốt (phương án A cho cả DEC-06 và DEC-08; toàn bộ 6 điều kiện cho DEC-07) và đã triển khai xong mã nguồn — đã kiểm tra qua test tự động (23 unit test mới, 16 e2e test mới, toàn bộ regression backend/frontend đạt). Chi tiết đầy đủ: `docs/requirements/CLOSURE_LIQUIDATION_DESIGN.md`. Nội dung gốc bên dưới (mô tả vấn đề, 13 câu hỏi cần làm rõ) được giữ nguyên làm hồ sơ lịch sử.

Đây là điểm phức tạp nhất trong gói xác nhận này. Hệ thống hiện có **hai luồng đóng hồ sơ độc lập, không đồng bộ với nhau**, và **không luồng nào khớp hoàn toàn với mô tả của khách hàng**.

### Luồng A — Đóng hồ sơ theo Hợp đồng (Contract)
- **Người thực hiện:** Chỉ HCTH.
- **Điều kiện kiểm tra:** Trước khi đánh dấu "Hoàn tất" (COMPLETED) — chỉ kiểm tra công nợ (phải hết nợ). Trước khi đánh dấu "Đã thanh lý" (LIQUIDATED) — chỉ yêu cầu nhập một lý do bằng văn bản tự do (không có xác nhận từ bên thứ hai).
- **Không kiểm tra:** dịch vụ đã hoàn thành hay chưa (visa, nhập học...), tài liệu đã bàn giao hay chưa, xác nhận hai bên.

### Luồng B — Đóng hồ sơ theo Case (học sinh)
- **Người thực hiện:** Giám đốc điều hành / Trưởng phòng / Nhân viên tư vấn (**không bao gồm HCTH**).
- **Điều kiện kiểm tra:** không còn công việc (task) nào đang mở, hết công nợ, visa không còn đang xử lý dở, đã xác nhận nhập học (nếu có hồ sơ ứng tuyển đang xử lý), checklist trước khi bay đã hoàn tất.
- **Không kiểm tra:** tài liệu bàn giao; và luồng này **không có khái niệm "thanh lý"** — chỉ có "đóng."

### YÊU CẦU KHÁCH HÀNG (trích nguyên văn):
- Sheet `02_Phan_quyen`, dòng 7: HCTH phụ trách "Hợp đồng, thanh toán, công nợ, **thanh lý**."
- Sheet `11_Quan_ly_hop_dong`, dòng 12: "Hoàn tất | Kiểm tra nghĩa vụ | **Dịch vụ hoàn thành, công nợ, tài liệu bàn giao** | HCTH/Quản lý | Closure Checklist | COMPLETED."
- Sheet `11_Quan_ly_hop_dong`, dòng 13: "Thanh lý | Tạo biên bản thanh lý | **Ngày thanh lý, xác nhận hai bên** | HCTH | Liquidation Record | LIQUIDATED."
- Sheet `01_Cau_truc_he_thong`, dòng 22: "Thanh lý | Bàn giao, công nợ, biên bản | Kiểm tra nghĩa vụ | Contract Closure."

Theo văn bản, **HCTH là người phụ trách chính thức** cho cả hai bước Hoàn tất và Thanh lý.

### 13 CÂU HỎI CẦN LÀM RÕ

| # | Câu hỏi | Excel đã trả lời chưa? | Chi tiết |
|---|---|---|---|
| 1 | Vai trò nào là chủ sở hữu chính thức của việc Đóng hồ sơ? | **Đã trả lời một phần** | Excel nói rõ HCTH — nhưng hệ thống hiện tại lại chia thành hai luồng khác vai trò, không luồng nào khớp hoàn toàn với mô tả này. |
| 2 | HCTH có bắt buộc là người thực hiện đóng hồ sơ không? | **Đã trả lời — CÓ** | Nêu rõ tại sheet02 dòng 7 và sheet11 dòng 12-13. |
| 3 | Tư vấn/Trưởng phòng/GĐĐH có được phép đóng hồ sơ không? | **Chưa rõ** | Excel không liệt kê các vai trò này là người phụ trách bước Đóng hồ sơ, nhưng cũng không cấm. |
| 4 | Điều kiện nào là bắt buộc trước khi Hoàn tất? | **Đã trả lời ở mức mô tả** | Excel nêu tên 3 điều kiện (dịch vụ hoàn thành, công nợ, tài liệu bàn giao) nhưng không định nghĩa chi tiết từng điều kiện là gì cụ thể. |
| 5 | Công nợ có bắt buộc phải bằng 0 không? | **Đã trả lời — CÓ (ở mức khái niệm)** | "Công nợ" được liệt kê là điều kiện bắt buộc — nhưng chưa rõ "không còn nợ" hay "có kế hoạch trả nợ được duyệt" cũng được chấp nhận. |
| 6 | Tất cả công việc (task) đang mở có bắt buộc phải đóng không? | **Chưa rõ** | Không được nêu cụ thể trong dòng mô tả giai đoạn Đóng hồ sơ — đây là điều kiện hệ thống hiện tại tự thêm vào (ở Luồng B), không có trong văn bản gốc. |
| 7 | Visa có bắt buộc phải được cấp/hoàn tất không? | **Chưa rõ** | Tương tự câu 6 — không được nêu cụ thể, là điều kiện hệ thống tự thêm vào. |
| 8 | Nhập học (Enrollment) có bắt buộc phải xác nhận không? | **Chưa rõ** | Tương tự câu 6/7. |
| 9 | Checklist trước khi bay (Pre-departure) có bắt buộc hoàn tất không? | **Chưa rõ** | Tương tự câu 6/7/8. |
| 10 | Bàn giao tài liệu có bắt buộc hoàn tất không? | **Đã trả lời — CÓ** | Nêu rõ "tài liệu bàn giao" là một trong 3 điều kiện — nhưng **hiện chưa được kiểm tra ở bất kỳ luồng nào trong hệ thống**, và văn bản không định nghĩa cụ thể "bàn giao" nghĩa là gì (giao loại tài liệu nào, giao cho ai, xác nhận bằng cách nào). |
| 11 | "Thanh lý" nghĩa là gì cụ thể? | **Đã trả lời ở mức khái niệm** | Cần có ngày thanh lý và "xác nhận hai bên" — nhưng cơ chế xác nhận cụ thể (chữ ký điện tử, xác nhận trong hệ thống của cả hai phía, tài liệu ký tay được tải lên...) không được nêu. |
| 12 | Đóng hồ sơ và Thanh lý có thể do hai vai trò khác nhau thực hiện không? | **Chưa rõ** | Excel ghi cả hai bước đều do HCTH thực hiện, không đề cập khả năng tách vai trò. |
| 13 | Có cần cơ chế phê duyệt/tách biệt trách nhiệm (approval / separation of duties) không? | **Chưa rõ** | Không được đề cập cho riêng bước Đóng hồ sơ — dù hệ thống có áp dụng nguyên tắc này cho việc phê duyệt hợp đồng ở mức tiền tệ cao (một quy trình khác trong cùng sheet11). |

### VẤN ĐỀ CẦN QUYẾT ĐỊNH

Cốt lõi vấn đề: **hệ thống hiện tại không có một luồng duy nhất nào cho phép HCTH — vai trò được văn bản chỉ định — thực hiện đầy đủ các điều kiện mà văn bản yêu cầu.** HCTH chỉ tiếp cận được luồng kiểm tra công nợ (yếu hơn); luồng kiểm tra đầy đủ hơn (task, visa, nhập học, checklist) lại chỉ dành cho các vai trò khác. Không luồng nào kiểm tra việc bàn giao tài liệu.

**KHÁCH HÀNG CẦN QUYẾT ĐỊNH:** CÓ — đây là một cuộc thảo luận thiết kế nghiệp vụ, không phải một lỗi có thể sửa nhanh bằng một dòng code.

---

## 10. Liên kết Hoa hồng ↔ Visa (Commission ↔ Visa Traceability) — **ĐÃ QUYẾT ĐỊNH 2026-08-27**

**TRẠNG THÁI HIỆN TẠI:**
- Liên kết Hoa hồng ↔ Hợp đồng: ĐÃ CÓ (đã xây dựng, đã kiểm thử).
- Liên kết Hoa hồng ↔ Học bổng: ĐÃ CÓ (đã xây dựng, đã kiểm thử).
- Liên kết Hoa hồng ↔ Visa: **CHƯA CÓ** — không có cách nào trong hệ thống để tra cứu trực tiếp "khoản hoa hồng này gắn với kết quả visa nào."

**YÊU CẦU KHÁCH HÀNG (trích nguyên văn):**
Sheet `16_Contract_Partner_Link`, dòng tiêu đề: "Student ID | Contract ID | Partner ID | Trường/Đơn vị | Vai trò đối tác | Chương trình | Application | Scholarship | **Visa** | Trạng thái" — Visa được liệt kê ngang hàng với Application và Scholarship, không có ghi chú "tùy chọn."

**PHÁT HIỆN QUAN TRỌNG khi đối chiếu thêm với sheet quan hệ dữ liệu:** Sheet `19_Quan_he_du_lieu` — sheet chuyên định nghĩa các mối quan hệ dữ liệu bắt buộc giữa các bảng — **hoàn toàn không có bất kỳ dòng nào liên kết Visa với Contract, Partner, hoặc Commission**. Sheet này chỉ có một dòng duy nhất liên quan đến Visa: "Student → Visa" (một học sinh có thể có nhiều lần xử lý visa). Đây là một tín hiệu trái chiều với cách hiểu từ sheet16.

**MỨC ĐỘ BẮT BUỘC:** **MƠ HỒ (AMBIGUOUS)** — sheet16 gợi ý là bắt buộc (không có ghi chú tùy chọn), nhưng sheet19 (sheet định nghĩa quan hệ dữ liệu chính thức) lại hoàn toàn im lặng về mối quan hệ này. Đội kỹ thuật **không tự kết luận** mức độ bắt buộc từ hai tín hiệu trái chiều này.

**VÌ SAO ĐIỀU NÀY QUAN TRỌNG:** Nếu cần tính toán hoa hồng, đối soát với đối tác, hoặc báo cáo hiệu quả đối tác dựa trên kết quả visa cụ thể, thì việc thiếu liên kết này sẽ khiến các báo cáo đó phải tra cứu thủ công qua nhiều bước thay vì tự động.

**CÁC MÔ HÌNH TRIỂN KHAI KHẢ THI (chỉ liệt kê để tham khảo, CHƯA triển khai bất kỳ phương án nào):**
- **Mô hình A — Liên kết trực tiếp:** Thêm một trường "Visa liên quan" trực tiếp vào bản ghi Hoa hồng/Liên kết đối tác-học sinh, theo đúng cách đã làm với Hợp đồng/Học bổng gần đây.
- **Mô hình B — Tham chiếu nguồn cố định:** Tự động xác định và "chốt" visa liên quan tại thời điểm tính hoa hồng (tương tự cách hệ thống hiện đang tự động xác định hợp đồng liên quan).
- **Mô hình C — Liên kết linh hoạt qua nhiều bước:** Mở rộng cơ chế tra cứu nguồn hiện có để có thể tùy chọn đi qua Visa như một bước tra cứu bổ sung (tương tự cách hiện tại đang tra cứu Hợp đồng qua Thanh toán).
- **Mô hình D — Không cần trường riêng:** Dựa vào liên kết Học sinh↔Visa đã có sẵn, để báo cáo tự nối dữ liệu qua Học sinh thay vì lưu liên kết trực tiếp trên bản ghi Hoa hồng.

**KHÁCH HÀNG CẦN XÁC NHẬN:** ~~CÓ — cả về mức độ bắt buộc lẫn mô hình triển khai~~ **Đã quyết định.**

---

**KHÁCH HÀNG CHỐT (2026-08-27):** *"Có, bắt buộc liên kết trực tiếp Hoa hồng ↔ Visa đối với
các khoản hoa hồng phát sinh từ Visa. Không bắt buộc đối với các khoản hoa hồng không có
nguồn từ Visa. visaId là nullable ở cấp dữ liệu nhưng bắt buộc theo loại nguồn hoa hồng."*

**Mô hình đã chọn:** Mô hình A/B (liên kết trực tiếp, tự động xác định tại thời điểm tạo giao
dịch) — đúng cách đã làm với Hợp đồng (`contractId`) trước đây, không phải một cơ chế mới.

**ĐÃ TRIỂN KHAI:** `CommissionTransaction.visaId` (migration
`20260827060023_commission_transaction_visa_link`) — tự động điền khi `sourceType='Visa'`,
dùng đúng cơ chế `resolveSource()` đã có sẵn cho `contractId`, nên "bắt buộc theo loại nguồn"
tự nhiên đúng mà không cần thêm tầng kiểm tra riêng. `sourceType` nay có thêm giá trị `'Visa'`
bên cạnh `'Contract'`/`'Payment'`.

**Lưu ý kỹ thuật phát sinh (không phải quyết định nghiệp vụ mới):** Visa không có trường tiền
tệ nào cả, nên hoa hồng phát sinh từ Visa **chỉ có thể tính theo mức cố định (FIXED)**, không
thể tính theo phần trăm của một giá trị nào đó. Hệ thống từ chối rõ ràng
(`COMMISSION_BASIS_MUST_BE_FIXED_FOR_VISA`) nếu lỡ gắn nhầm quy tắc phần trăm vào giao dịch có
nguồn Visa, thay vì đọc nhầm sang dữ liệu Thanh toán không liên quan.

**Cố tình chưa làm:** `PartnerStudentLink.visaId` — câu trả lời của khách hàng chỉ nói về "Hoa
hồng ↔ Visa," không nhắc tới `PartnerStudentLink`, nên phần đó vẫn để ngỏ, chưa xây.

**Kiểm thử:** 5 test e2e mới. ~~Toàn bộ regression backend/frontend đạt.~~ **(2026-08-27) Backend unit 209/209, backend e2e 556/557, frontend 325/325. Trường hợp fail duy nhất (`rbac.e2e-spec.ts`) đã được xác minh trực tiếp qua DB là lỗi không liên quan, có từ trước (một tài khoản demo tích lũy hơn 106 case-membership qua nhiều lần chạy e2e lặp lại trên DB dev không được reset, đẩy học sinh fixture gốc ra khỏi trang mặc định 100 dòng) — không liên quan gì đến Hoa hồng/Visa, không sửa vì ngoài phạm vi. Đồng thời đã kiểm tra trực tiếp trên trình duyệt: tạo thật một `CommissionRule` mức cố định (FIXED, 75 USD) và một `CommissionTransaction` nguồn Visa qua đúng giao diện thật, chạy qua "Xác nhận đủ điều kiện" → "Tính toán", ra đúng số tiền, đối chiếu `visaId`/`contractId` trực tiếp trong DB — khớp hoàn toàn với thiết kế. Dữ liệu test đã được xoá sau khi xác nhận.**

**Ý nghĩa quan trọng:** Đây là **phát hiện mức HIGH cuối cùng còn treo** trong toàn bộ đợt
nghiệm thu — xem `CLIENT_ACCEPTANCE_REPORT.md` để biết kết luận nghiệm thu cuối cùng đã cập
nhật như thế nào sau quyết định này.

---

## 11. Các câu hỏi mở khác (không thuộc 4 mâu thuẫn chính thức)

Các điểm dưới đây không đủ nghiêm trọng để chặn việc chấp nhận hệ thống, nhưng cũng không thể tự suy đoán — liệt kê ở đây để khách hàng tham khảo, không yêu cầu quyết định gấp:

- **Phân quyền "Hạn chế" đang bị hiểu thành "Không có quyền"** cho 4 trường hợp (Tư vấn với Tài liệu đối tác; HCTH với Tài liệu đối tác và Visa; Sale/Marketing với Hồ sơ học sinh và Competition; HCTH với Hồ sơ học sinh) — mức độ trung bình, không chặn nghiệm thu, nhưng lặp lại 4 lần cho thấy có thể là lỗi hệ thống khi xây dựng ban đầu, nên khách hàng có thể muốn yêu cầu rà soát lại toàn bộ bảng phân quyền một lần cho dứt điểm thay vì sửa từng trường hợp riêng lẻ.
- **Module "Marketing"** hiện chưa có giao diện riêng — dữ liệu nguồn lead/chiến dịch hiện được gộp chung vào hồ sơ Lead, chưa tách thành module độc lập như văn bản mô tả.
- **Loại đối tác (Partner Type)** hiện chỉ có 4 loại trong hệ thống, trong khi văn bản liệt kê 7 loại (Trường đại học/Trường phổ thông/Tổ chức học bổng/Đối tác visa/Lưu trú/Bảo hiểm/Tuyển sinh).

---

## 12. Tổng hợp quyết định đề xuất

| Mã quyết định | Chủ đề | Phương án đề xuất |
|---|---|---|
| DEC-01 | Ngưỡng thanh toán kích hoạt hợp đồng | ~~Giữ nguyên (bất kỳ khoản thanh toán nào)~~ **Khách hàng chốt 2026-08-27: tối thiểu 30% giá trị hợp đồng (thanh toán dưới 30% chưa đủ điều kiện kích hoạt). Đã sửa code — xem `ContractsService.updateStatus` (`ACTIVATION_PAYMENT_THRESHOLD_RATIO`), CLIENT_ACCEPTANCE_MATRIX.md REQ-CONTRACT-002, CLIENT_REQUIREMENT_CONFLICTS.md CONFLICT-001.** |
| DEC-02 | Vai trò Quản trị hệ thống | Ghi nhận chính thức, không thay đổi hệ thống |
| DEC-03 | Phạm vi truy cập dữ liệu Đối tác | ~~Không đủ cơ sở đề xuất — cần khách hàng chọn~~ **Khách hàng chốt 2026-08-27: Không giới hạn Partner theo Case — Partner là dữ liệu chung toàn công ty, nhân viên có `partners:view` xem theo phạm vi toàn công ty. Dữ liệu/hoạt động nhạy cảm vẫn kiểm soát bằng permission + field-level access. Không cần sửa code — hành vi hiện tại đã đúng ý định.** |
| DEC-04 | Yêu cầu bắt buộc của GPA | ~~Giữ GPA bắt buộc (theo sheet Student Profile)~~ **Khách hàng chốt 2026-08-25: GPA là Optional (theo sheet17). Đã sửa code — xem mục 7.** |
| DEC-05 | Trường "Trường học" của học sinh | ~~Bổ sung trường mới, nhập tự do, gắn trực tiếp vào hồ sơ học sinh~~ **Đính chính 2026-08-25: trường đã tồn tại sẵn (trên `AcademicRecord`, không phải trực tiếp trên hồ sơ học sinh) — không cần bổ sung mã nguồn. (b) giai đoạn nào thì bắt buộc — đã được xác nhận 2026-08-25: chặn ở bước phê duyệt Assessment là đúng ý định.** **Khách hàng chốt 2026-08-27: (a) lưu theo từng năm học, không ghi đè lịch sử — hành vi có sẵn, không cần sửa code; (c) ưu tiên chọn từ danh sách School Master, vẫn cho phép nhập tự do khi trường chưa có — đã xây `SchoolMaster` + liên kết tùy chọn từ `AcademicRecord`, đã kiểm thử đầy đủ.** |
| DEC-06 | Vai trò chính thức của việc Đóng hồ sơ | ~~Cần thảo luận thiết kế — không đề xuất áp đặt~~ **Khách hàng chốt 2026-08-26: Phương án A — một luồng hợp nhất, HCTH thực hiện tiêu chuẩn, Trưởng phòng/GĐĐH xử lý ngoại lệ có kiểm toán, Tư vấn chỉ đề nghị. Đã triển khai — xem `CLOSURE_LIQUIDATION_DESIGN.md`.** |
| DEC-07 | Danh sách điều kiện bắt buộc trước khi Đóng hồ sơ | ~~Cần khách hàng xác nhận từng điều kiện~~ **Khách hàng chốt 2026-08-26: cả 6 điều kiện đều bắt buộc (công nợ, task mở, visa, nhập học, checklist trước khi bay, bàn giao tài liệu — mục cuối trước đây chưa được kiểm tra). Đã triển khai.** |
| DEC-08 | Cơ chế "xác nhận hai bên" khi Thanh lý | ~~Cần khách hàng xác nhận cơ chế cụ thể~~ **Khách hàng chốt 2026-08-26: Phương án A — xác nhận độc lập trong hệ thống từ cả hai phía (công ty + học sinh/phụ huynh), bất biến sau khi hoàn tất. Đã triển khai.** |
| DEC-09 | Mức độ bắt buộc của liên kết Hoa hồng↔Visa | ~~Cần khách hàng xác nhận trước khi chọn mô hình triển khai~~ **Khách hàng chốt 2026-08-27: bắt buộc cho hoa hồng phát sinh từ Visa, không bắt buộc cho nguồn khác — `visaId` nullable ở data nhưng bắt buộc theo loại nguồn. Đã thêm `CommissionTransaction.visaId`, tự động điền qua `resolveSource()`. Đây là phát hiện HIGH cuối cùng — nay đã đóng.** |
| DEC-10 | Giải thưởng (Awards) cho hoạt động ngoại khóa thuần túy (sheet04 row13, GAP-026) — không có field riêng, chỉ nằm trong mô tả tự do `impact` | **Khách hàng chốt 2026-08-25: bổ sung field riêng. Đã thêm `Activity.award` — xem mục "CODE FIXES APPLIED" tại `CLIENT_ACCEPTANCE_MATRIX.md`.** |

## 13. Tóm tắt ảnh hưởng

- **Không có quyết định nào ở trên yêu cầu thay đổi khẩn cấp** — hệ thống hiện tại hoạt động ổn định với các cách hiểu tạm thời đã chọn.
- ~~**Chi phí kỹ thuật để triển khai sau khi có quyết định là thấp** cho DEC-01, 02, 09~~ **DEC-01 và DEC-09 (2026-08-27): đã chốt và triển khai xong** — xem mục 4 và mục 10. DEC-02 vẫn chỉ cần ghi nhận, không cần thay đổi hệ thống. **DEC-04 và DEC-10 (2026-08-25): đã sửa code xong** — DEC-04 (bỏ yêu cầu GPA khỏi cổng phê duyệt Assessment) và DEC-10 (thêm `Activity.award`), cả hai đã kiểm tra qua test tự động (assessment-roadmap 20/20, profile-evidence 17/17). **DEC-05 (đính chính 2026-08-25): không còn cần thay đổi mã nguồn cho phần trường đã tồn tại.** **DEC-05 (2026-08-27): cả 2 câu hỏi con (a)(c) đã được khách hàng chốt và triển khai xong — (a) không cần sửa code (hành vi có sẵn), (c) đã xây `SchoolMaster` + `SchoolPicker`, kiểm thử đầy đủ (backend e2e 552/552, frontend 325/325). Không còn câu hỏi mở nào cho DEC-05.**
- ~~**DEC-06/07/08 (Đóng hồ sơ/Thanh lý) cần một buổi thảo luận thiết kế riêng** trước khi có thể ước tính chi phí kỹ thuật — đây không phải một thay đổi nhỏ.~~ **Cập nhật 2026-08-26: đã chốt và triển khai xong** — luồng Đóng hồ sơ hợp nhất (migration mới, module backend mới, 2 trang frontend mới, cập nhật RBAC), kiểm tra qua 23 unit test + 16 e2e test mới, toàn bộ regression đạt. Xem `docs/requirements/CLOSURE_LIQUIDATION_DESIGN.md`.
- ~~**DEC-03 (phạm vi đối tác) cần làm rõ trước khi có thể đánh giá mức độ ảnh hưởng.**~~ **Cập nhật 2026-08-27: đã chốt — không giới hạn theo case (Phương án C), không cần sửa code, hành vi hiện tại đã đúng.**

---

## 14. Xác nhận của khách hàng (Client Sign-off)

Vui lòng đánh dấu và điền thông tin bên dưới sau khi xem xét toàn bộ tài liệu này.

**QUYẾT ĐỊNH CỦA KHÁCH HÀNG:**

- [ ] Đồng ý theo đề xuất (Approved as proposed)
- [ ] Đồng ý với thay đổi (Approved with changes)
- [ ] Cần thảo luận thêm (Requires discussion)

**GHI CHÚ CỦA KHÁCH HÀNG (Client Comments):**

_______________________________________________
_______________________________________________
_______________________________________________

**NGƯỜI PHÊ DUYỆT (Approved by):**

_______________________________________________

**NGÀY (Date):**

_______________________________________________

---

*Phụ lục kỹ thuật đầy đủ (chi tiết entity, API, route, quyền, migration, và phạm vi ảnh hưởng hồi quy cho từng quyết định) có tại `docs/requirements/CLIENT_CLARIFICATION_TECHNICAL_APPENDIX.md`, dành cho đội kỹ thuật tham khảo — không cần thiết cho việc đọc và quyết định ở tài liệu này.*

# Forex Candlestick Chart & Multi-Timeframe Directional Line Viewer

A high-performance Forex candlestick charting web application built with **React**, **TypeScript**, **Tailwind CSS**, and **Lightweight Charts** (TradingView).

It supports importing candlestick data and technical lines via **plain JSON** (`.json`) or **compressed GZIP** (`.gz`, `.json.gz`) files, with full multi-timeframe navigation (`D1`, `H4`, `H1`, `M15`, `M5`, `M2`), 1-way downward inheritance, Market Structure (HH/HL, LH/LL), and TradingView-style sub-candle wick snapping.

---

## 🌟 Key Features

1. **Directional Lines (Chỉ có 2 chiều: Tăng hoặc Giảm)**:
   - **Chiều tăng (`direction: "up"`)**: Nối từ đáy (Low) của cây nến đầu tiên đến đỉnh (High) của cây nến cuối cùng.
   - **Chiều giảm (`direction: "down"`)**: Nối từ đỉnh (High) của cây nến đầu tiên đến đáy (Low) của cây nến cuối cùng.
   - Điểm mút 2 đầu đường vẽ thanh mảnh, liền mạch, không có chấm tròn dư thừa.

2. **Thừa kế 1 chiều (Khung lớn → Khung nhỏ) & Co giãn TradingView**:
   - Các đường vẽ (Elements) được định nghĩa riêng cho từng khung thời gian (`sourceTimeframe`).
   - **Thừa kế 1 chiều**: Đường vẽ từ khung lớn (ví dụ `H1`) sẽ tự động hiển thị và kéo dãn xuống các khung nhỏ hơn (`M15`, `M5`). Đường vẽ ở khung nhỏ (`M15`) **không bao giờ** xuất hiện trên khung lớn (`H1`).

3. **Neo bám đỉnh/đáy nến con chính xác tuyệt đối (Sub-Candle Snapping)**:
   - Khi chuyển từ khung lớn xuống khung nhỏ hơn (ví dụ `H1` ra 4 nến `M15`), đường vẽ tự động quét toàn bộ các nến con trong phạm vi thời gian của nến mẹ:
     - Điểm đỉnh (`High`): Neo chính xác vào cây nến con có **High cao nhất**.
     - Điểm đáy (`Low`): Neo chính xác vào cây nến con có **Low thấp nhất**.
   - Xử lý hoàn hảo cả các trường hợp **không chia hết** (ví dụ từ `M5` sang `M2` với tỷ lệ 2.5).

4. **Sơ đồ Cấu trúc thị trường (Market Structure)**:
   - Hỗ trợ mô hình cấu trúc xu hướng hoàn chỉnh:
     - **Bullish Market Structure (HH - HL)**: Higher Highs và Higher Lows.
     - **Bearish Market Structure (LH - LL)**: Lower Highs và Lower Lows.
   - Gom các đoạn cấu trúc thành 1 đường line lớn duy nhất (**Element**), bật/tắt toàn bộ cấu trúc chỉ bằng 1 nút bấm.

5. **Quản lý Elements trực quan (Gọn gàng kiểu 1 Line)**:
   - Nút **Elements** trên thanh công cụ hiển thị số lượng phần tử đang bật / tổng số.
   - Popover hiển thị danh sách dạng từng dòng gọn gàng, có huy hiệu khung thời gian nguồn (`H4`, `H1`), không hiển thị số lượng line con rườm rà.
   - Rê chuột vào Element nào thì toàn bộ cấu trúc của Element đó trên biểu đồ sẽ cùng sáng lên.

6. **Pibonacci (Fibonacci Retracement & Extension)**:
   - Hiển thị chính xác tại **đúng khung thời gian** đã đặt Pibo (`exactTimeframeOnly: true`), không kế thừa sang các khung thời gian khác.
   - Hỗ trợ đầy đủ: điểm bắt đầu (`fromTime`/`fromCandleIndex`), điểm kết thúc (`toTime`/`toCandleIndex`), giá bắt đầu (`fromPrice`), giá kết thúc (`toPrice`).
   - Cấu hình các điểm đầu và cuối: ví dụ `startLevel: 0`, `endLevel: 1` hoặc `1.618`, hoặc danh sách `levels` tùy chỉnh.
   - Tô màu các vùng cụ thể: ví dụ `0.618 -> 0.8` tô màu đỏ (`zones: [{ fromLevel: 0.618, toLevel: 0.8, color: "red" }]`).

7. **Tập tin kiểm thử tập trung (`test_data/` & `tests/`)**:
   - Thư mục `test_data/` chứa script Python `generate_test_data.py` sinh dữ liệu chuẩn hóa Market Structure.
   - Thư mục `tests/` sử dụng Vitest kiểm tra tự động tỷ lệ chuyển đổi, quy tắc thừa kế 1 chiều và thuật toán neo bám nến con.

---

## 📋 JSON Schema Specification

```json
{
  "symbol": "EUR/USD",
  "title": "EUR/USD Multi-Timeframe Market Structure",
  "description": "Candles and lines are 100% price-consistent across timeframes.",

  // 1. TIMEFRAME UNITS (Đơn vị tính bằng Giây)
  "timeframeUnits": {
    "D1": 86400,
    "H4": 14400,
    "H1": 3600,
    "M15": 900,
    "M5": 300,
    "M2": 120,
    "M1": 60
  },

  // 2. TIMEFRAME CONVERSIONS (Tỷ lệ chuyển đổi 1 chiều: Khung to -> Khung nhỏ)
  "timeframeConversions": [
    { "from": "D1", "to": "H4", "ratio": 6 },
    { "from": "H4", "to": "H1", "ratio": 4 },
    { "from": "H1", "to": "M15", "ratio": 4 },
    { "from": "M15", "to": "M5", "ratio": 3 },
    { "from": "M5", "to": "M2", "ratio": 2.5 },
    { "from": "M2", "to": "M1", "ratio": 2 }
  ],

  // 3. TIMEFRAMES (Chứa nến và các đường vẽ riêng của từng khung)
  "timeframes": {
    "H4": {
      "candles": [
        {
          "time": 1704067200,
          "open": 1.072,
          "high": 1.078,
          "low": 1.071,
          "close": 1.075
        }
      ],
      "drawings": [
        {
          "id": "h4-ms-leg1",
          "type": "line",
          "direction": "up", // 'up': Đáy nến 1 -> Đỉnh nến 2
          "color": "#38bdf8",
          "element": "H4 Bullish Market Structure (HH/HL)",
          "fromTime": 1704067200,
          "toTime": 1704600000,
          "sourceTimeframe": "H4", // Thừa kế xuống H1 & M15, không hiện trên D1
          "stretch": true
        },
        {
          "id": "h4-ms-leg2",
          "type": "line",
          "direction": "down", // 'down': Đỉnh nến 1 -> Đáy nến 2
          "color": "#fb7185",
          "element": "H4 Bullish Market Structure (HH/HL)",
          "fromTime": 1704600000,
          "toTime": 1705000000,
          "sourceTimeframe": "H4",
          "stretch": true
        },
        {
          "id": "h4-pibo-1",
          "type": "pibo",
          "fromTime": 1704067200, // Điểm bắt đầu
          "toTime": 1704600000,   // Điểm kết thúc
          "fromPrice": 1.071,     // Giá bắt đầu
          "toPrice": 1.078,       // Giá kết thúc
          "startLevel": 0,        // Mức bắt đầu
          "endLevel": 1.618,      // Mức kết thúc (0 -> 1 hoặc 1.618)
          "zones": [
            {
              "fromLevel": 0.618, // Vùng 0.618 -> 0.8
              "toLevel": 0.8,
              "color": "red"      // Tô màu đỏ
            }
          ]
        }
      ]
    },
    "H1": {
      "candles": [ ... ],
      "drawings": [ ... ]
    }
  },
  "defaultTimeframe": "H4"
}
```

---

## 🚀 Getting Started

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
```

### Chạy Tests

```bash
npm test
```

### Kiểm tra toàn bộ mã nguồn & chạy Tests

```bash
npm run verify
```

### Sinh dữ liệu test (.json & .json.gz)

```bash
python test_data/generate_test_data.py
```

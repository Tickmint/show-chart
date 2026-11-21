# Forex Candlestick Chart & Multi-Timeframe Directional Line Viewer

A high-performance Forex candlestick charting web application built with **React**, **TypeScript**, **Tailwind CSS**, and **Lightweight Charts** (TradingView).

It supports importing candlestick data and technical lines via **plain JSON** (`.json`) or **compressed GZIP** (`.gz`, `.json.gz`) files, with full multi-timeframe navigation (`D1`, `H4`, `H1`, `M15`), TradingView-style candle stretching, and individual line visibility toggles.

---

## 🌟 Key Features

1. **Directional Lines (Chỉ có 2 chiều: Tăng hoặc Giảm)**:
   - **Chiều tăng (`direction: "up"`)**: Nối từ đáy (Low) của cây nến đầu tiên đến đỉnh (High) của cây nến cuối cùng.
   - **Chiều giảm (`direction: "down"`)**: Nối từ đỉnh (High) của cây nến đầu tiên đến đáy (Low) của cây nến cuối cùng.
   - Các điểm neo bám trực tiếp và chính xác vào râu nến (candle wicks).

2. **TradingView-Style Multi-Timeframe Stretch (`stretch: true`)**:
   - Khi vẽ trên khung thời gian lớn (ví dụ `H4`), đường line co giãn mượt mà theo đúng thứ tự nến khi chuyển sang các khung thời gian nhỏ hơn (`H1` kéo dãn x4 nến, `M15` kéo dãn x16 nến).
   - Nếu đặt `stretch: false`, đường line chỉ hiển thị trên khung thời gian gốc của nó.

3. **Zero-Desync 60fps Canvas Overlay**:
   - Vòng lặp animation frame đồng bộ 1:1 giữa nến Lightweight Charts và overlay Canvas khi kéo rê (pan/drag) hoặc zoom biểu đồ.

4. **Show/Hide Item Popover**:
   - Nút **Show/Hide Item** duy nhất trên thanh công cụ, mở danh sách các đường line đang có mặt trên khung thời gian đang chọn kèm huy hiệu `UP` / `DOWN` và nút con mắt bật/tắt hiển thị từng đường.

5. **Tập tin kiểm thử tập trung (`test_data/`)**:
   - Thư mục `test_data/` chứa script Python `generate_test_data.py` và các bộ dữ liệu test Forex (`EUR/USD`, `GBP/USD`, `USD/JPY`, `XAU/USD`) định dạng `.json` và `.json.gz`.

---

## 📋 JSON Schema Specification

```json
{
  "symbol": "EUR/USD",
  "title": "EUR/USD Multi-Timeframe Line Structure",
  "description": "Candles and lines are 100% price-consistent across timeframes.",

  // 1. COMMON DRAWINGS (Placed OUTSIDE individual timeframes)
  "commonDrawings": [
    {
      "id": "macro-bullish-line",
      "type": "line",
      "direction": "up", // 'up': Đáy nến 1 -> Đỉnh nến 2
      "color": "#10b981",
      "fromTime": 1704067200,
      "toTime": 1708000000,
      "lineWidth": 2,
      "stretch": true,
      "description": "Bullish line from candle 1 Low to candle 2 High across all timeframes."
    },
    {
      "id": "macro-bearish-line",
      "type": "line",
      "direction": "down", // 'down': Đỉnh nến 1 -> Đáy nến 2
      "color": "#ef4444",
      "fromTime": 1708000000,
      "toTime": 1709500000,
      "lineWidth": 2,
      "stretch": true,
      "description": "Bearish line from candle 1 High to candle 2 Low across all timeframes."
    }
  ],

  // 2. TIMEFRAMES (With SPECIFIC lines placed INSIDE each timeframe)
  "timeframes": {
    "H4": {
      "candles": [
        { "time": 1704067200, "open": 1.0720, "high": 1.0780, "low": 1.0710, "close": 1.0750 }
      ],
      "drawings": [
        {
          "id": "h4-swing-up",
          "type": "line",
          "direction": "up",
          "color": "#38bdf8",
          "fromTime": 1704067200,
          "toTime": 1704600000,
          "stretch": true,
          "description": "H4 Bullish line (candle 1 Low -> candle 2 High), stretches to H1 & M15."
        }
      ]
    },
    "H1": {
      "candles": [
        { "time": 1704067200, "open": 1.0720, "high": 1.0740, "low": 1.0715, "close": 1.0735 }
      ],
      "drawings": []
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

### Sinh dữ liệu test (.json & .json.gz)
```bash
python test_data/generate_test_data.py
```

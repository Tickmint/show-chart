import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '../..');

console.log(
  '\n[TEST SUITE] Timeframe Conversions, 1-Way Downward Inheritance & Market Structure\n',
);

const DEFAULT_TIMEFRAME_UNITS = {
  MN1: 2592000,
  W1: 604800,
  D1: 86400,
  H12: 43200,
  H8: 28800,
  H6: 21600,
  H4: 14400,
  H2: 7200,
  H1: 3600,
  M30: 1800,
  M15: 900,
  M10: 600,
  M5: 300,
  M3: 180,
  M2: 120,
  M1: 60,
};

function parseTimeframeDuration(tf, customUnits) {
  if (!tf) return 3600;
  const upper = tf.toUpperCase().trim();
  if (customUnits && typeof customUnits[upper] === 'number') {
    return customUnits[upper];
  }
  if (DEFAULT_TIMEFRAME_UNITS[upper]) {
    return DEFAULT_TIMEFRAME_UNITS[upper];
  }
  const match = upper.match(/^([A-Z]+)(\d+)$/);
  if (match) {
    const unit = match[1];
    const val = parseInt(match[2], 10);
    if (!isNaN(val)) {
      if (unit === 'M') return val * 60;
      if (unit === 'H') return val * 3600;
      if (unit === 'D') return val * 86400;
      if (unit === 'W') return val * 604800;
      if (unit === 'S') return val;
    }
  }
  return 3600;
}

function canInheritTimeframe(sourceTf, targetTf, customUnits) {
  if (!sourceTf) return true;
  if (sourceTf === targetTf) return true;
  const sSec = parseTimeframeDuration(sourceTf, customUnits);
  const tSec = parseTimeframeDuration(targetTf, customUnits);
  return sSec >= tSec;
}

function getTimeframeConversionRatio(fromTf, toTf, customUnits) {
  const fSec = parseTimeframeDuration(fromTf, customUnits);
  const tSec = parseTimeframeDuration(toTf, customUnits);
  if (fSec <= tSec) return null;
  return Number((fSec / tSec).toFixed(4));
}

function resolveAnchorPoint({
  candleTime,
  sourceTimeframe,
  targetTimeframe,
  priceType,
  targetCandles,
  customUnits,
}) {
  if (targetCandles.length === 0) return null;
  const srcTf = sourceTimeframe || targetTimeframe;
  const srcDuration = parseTimeframeDuration(srcTf, customUnits);
  const targetDuration = parseTimeframeDuration(targetTimeframe, customUnits);

  if (srcDuration <= targetDuration) {
    const c =
      targetCandles.find((x) => x.time === candleTime) || targetCandles[0];
    const price =
      priceType === 'high' ? c.high : priceType === 'low' ? c.low : priceType;
    return { time: c.time, price };
  }

  const windowStart = candleTime;
  const windowEnd = windowStart + srcDuration;

  const overlapping = targetCandles.filter((c) => {
    const cStart = c.time;
    const cEnd = cStart + targetDuration;
    return cStart < windowEnd && cEnd > windowStart;
  });

  if (overlapping.length === 0) return null;

  if (priceType === 'high') {
    let best = overlapping[0];
    for (const c of overlapping) {
      if (c.high > best.high) best = c;
    }
    return { time: best.time, price: best.high };
  }

  if (priceType === 'low') {
    let best = overlapping[0];
    for (const c of overlapping) {
      if (c.low < best.low) best = c;
    }
    return { time: best.time, price: best.low };
  }

  return { time: overlapping[0].time, price: priceType };
}

// ============================================================================
// TEST 1: 1-Way Timeframe Conversion Ratios
// ============================================================================
{
  assert.strictEqual(getTimeframeConversionRatio('D1', 'H4'), 6.0);
  assert.strictEqual(getTimeframeConversionRatio('H4', 'H1'), 4.0);
  assert.strictEqual(getTimeframeConversionRatio('H1', 'M15'), 4.0);
  assert.strictEqual(getTimeframeConversionRatio('M15', 'M5'), 3.0);
  assert.strictEqual(getTimeframeConversionRatio('M5', 'M2'), 2.5); // Non-divisible scenario
  assert.strictEqual(getTimeframeConversionRatio('M2', 'M1'), 2.0);

  // Upward conversion is STRICTLY disallowed (returns null)
  assert.strictEqual(getTimeframeConversionRatio('M15', 'H1'), null);
  assert.strictEqual(getTimeframeConversionRatio('H1', 'H4'), null);
  assert.strictEqual(getTimeframeConversionRatio('H4', 'D1'), null);
  console.log(
    '✓ Test 1 Passed: 1-way conversion ratios strictly larger -> smaller (including non-divisible M5->M2 = 2.5)',
  );
}

// ============================================================================
// TEST 2: 1-Way Downward Inheritance Rules
// ============================================================================
{
  // Larger timeframes inherit down to smaller timeframes
  assert.strictEqual(canInheritTimeframe('D1', 'H4'), true);
  assert.strictEqual(canInheritTimeframe('D1', 'H1'), true);
  assert.strictEqual(canInheritTimeframe('D1', 'M15'), true);
  assert.strictEqual(canInheritTimeframe('H4', 'H1'), true);
  assert.strictEqual(canInheritTimeframe('H4', 'M15'), true);
  assert.strictEqual(canInheritTimeframe('H1', 'M15'), true);
  assert.strictEqual(canInheritTimeframe('M5', 'M2'), true);

  // Native display on same timeframe
  assert.strictEqual(canInheritTimeframe('H1', 'H1'), true);
  assert.strictEqual(canInheritTimeframe('M15', 'M15'), true);

  // Smaller timeframes CANNOT inherit up to larger timeframes
  assert.strictEqual(canInheritTimeframe('M15', 'H1'), false);
  assert.strictEqual(canInheritTimeframe('M15', 'H4'), false);
  assert.strictEqual(canInheritTimeframe('M15', 'D1'), false);
  assert.strictEqual(canInheritTimeframe('H1', 'H4'), false);
  assert.strictEqual(canInheritTimeframe('H1', 'D1'), false);
  assert.strictEqual(canInheritTimeframe('M2', 'M5'), false);
  console.log(
    '✓ Test 2 Passed: 1-way downward inheritance (H1 lines show on M15; M15 lines NEVER show on H1)',
  );
}

// ============================================================================
// TEST 3: Multi-Timeframe Anchor Snapping (Highest High & Lowest Low)
// ============================================================================
{
  // Scenario A: H1 -> M15 (1 to 4 candles)
  // 1 H1 candle at T=1000 spans [1000, 4600).
  // 4 M15 sub-candles:
  // - Candle 0: T=1000, H=1.0850, L=1.0810
  // - Candle 1: T=1900, H=1.0890 (PEAK HIGH), L=1.0830
  // - Candle 2: T=2800, H=1.0860, L=1.0790 (TROUGH LOW)
  // - Candle 3: T=3700, H=1.0840, L=1.0820
  const m15Candles = [
    { time: 1000, open: 1.082, high: 1.085, low: 1.081, close: 1.084 },
    { time: 1900, open: 1.084, high: 1.089, low: 1.083, close: 1.087 },
    { time: 2800, open: 1.087, high: 1.086, low: 1.079, close: 1.081 },
    { time: 3700, open: 1.081, high: 1.084, low: 1.082, close: 1.083 },
    { time: 4600, open: 1.083, high: 1.088, low: 1.082, close: 1.085 }, // Outside window
  ];

  const highAnchor = resolveAnchorPoint({
    candleTime: 1000,
    sourceTimeframe: 'H1',
    targetTimeframe: 'M15',
    priceType: 'high',
    targetCandles: m15Candles,
  });

  assert.strictEqual(
    highAnchor.time,
    1900,
    'Should snap to Candle 1 which has the highest High (1.089)',
  );
  assert.strictEqual(highAnchor.price, 1.089);

  const lowAnchor = resolveAnchorPoint({
    candleTime: 1000,
    sourceTimeframe: 'H1',
    targetTimeframe: 'M15',
    priceType: 'low',
    targetCandles: m15Candles,
  });

  assert.strictEqual(
    lowAnchor.time,
    2800,
    'Should snap to Candle 2 which has the lowest Low (1.079)',
  );
  assert.strictEqual(lowAnchor.price, 1.079);

  // Scenario B: Non-divisible M5 -> M2 (ratio 2.5)
  // 1 M5 candle at T=0 spans [0, 300).
  // M2 candles (duration 120):
  // - C0: T=0, span [0, 120), H=100, L=90
  // - C1: T=120, span [120, 240), H=108 (PEAK HIGH), L=95
  // - C2: T=240, span [240, 360), H=102, L=85 (TROUGH LOW)
  // - C3: T=360, span [360, 480), H=115 (Outside window, starts >= 300)
  const m2Candles = [
    { time: 0, open: 92, high: 100, low: 90, close: 95 },
    { time: 120, open: 95, high: 108, low: 95, close: 105 },
    { time: 240, open: 105, high: 102, low: 85, close: 88 },
    { time: 360, open: 88, high: 115, low: 87, close: 110 },
  ];

  const m2HighAnchor = resolveAnchorPoint({
    candleTime: 0,
    sourceTimeframe: 'M5',
    targetTimeframe: 'M2',
    priceType: 'high',
    targetCandles: m2Candles,
  });

  assert.strictEqual(
    m2HighAnchor.time,
    120,
    'Should select C1 which has the highest high (108) inside M5 window [0, 300)',
  );
  assert.strictEqual(m2HighAnchor.price, 108);

  const m2LowAnchor = resolveAnchorPoint({
    candleTime: 0,
    sourceTimeframe: 'M5',
    targetTimeframe: 'M2',
    priceType: 'low',
    targetCandles: m2Candles,
  });

  assert.strictEqual(
    m2LowAnchor.time,
    240,
    'Should select C2 which has the lowest low (85) inside M5 window [0, 300)',
  );
  assert.strictEqual(m2LowAnchor.price, 85);

  console.log(
    '✓ Test 3 Passed: Multi-timeframe anchor snapping to highest High / lowest Low (both integer H1->M15 and fractional M5->M2)',
  );
}

// ============================================================================
// TEST 4: Generated Test Data Verification (Market Structure & Schema)
// ============================================================================
{
  const testDataPath = path.join(root, 'test_data', 'EUR_USD_test_data.json');
  assert.ok(fs.existsSync(testDataPath), 'EUR_USD_test_data.json must exist');

  const content = JSON.parse(fs.readFileSync(testDataPath, 'utf8'));

  // Check timeframe units
  assert.ok(content.timeframeUnits, 'Must contain timeframeUnits');
  assert.strictEqual(content.timeframeUnits.H1, 3600);
  assert.strictEqual(content.timeframeUnits.M15, 900);
  assert.strictEqual(content.timeframeUnits.M5, 300);
  assert.strictEqual(content.timeframeUnits.M2, 120);

  // Check timeframe conversions
  assert.ok(
    Array.isArray(content.timeframeConversions),
    'Must contain timeframeConversions array',
  );
  const m5toM2 = content.timeframeConversions.find(
    (c) => c.from === 'M5' && c.to === 'M2',
  );
  assert.ok(m5toM2, 'Must include M5 -> M2 conversion');
  assert.strictEqual(m5toM2.ratio, 2.5);

  // Confirm NO global common drawings (all are timeframe-specific)
  assert.strictEqual(
    content.commonDrawings,
    undefined,
    'commonDrawings should not be present; lines are strictly per timeframe',
  );

  // Check timeframes have Market Structure elements
  const h4Drawings = content.timeframes?.H4?.drawings || [];
  assert.ok(
    h4Drawings.length >= 3,
    'H4 must have Market Structure multi-leg drawings',
  );
  for (const d of h4Drawings) {
    assert.ok(
      d.element.includes('Market Structure'),
      'Drawing must belong to a Market Structure element',
    );
    assert.strictEqual(
      d.sourceTimeframe,
      'H4',
      'Drawings must declare native sourceTimeframe',
    );
  }

  const h1Drawings = content.timeframes?.H1?.drawings || [];
  assert.ok(
    h1Drawings.length >= 3,
    'H1 must have Market Structure multi-leg drawings',
  );
  for (const d of h1Drawings) {
    assert.ok(
      d.element.includes('Market Structure'),
      'Drawing must belong to a Market Structure element',
    );
    assert.strictEqual(
      d.sourceTimeframe,
      'H1',
      'Drawings must declare native sourceTimeframe',
    );
  }

  console.log(
    '✓ Test 4 Passed: Generated test data schema validated with timeframe units, 1-way conversions & Market Structure',
  );
}

console.log(
  '\n[SUCCESS] All timeframe & Market Structure tests passed successfully!\n',
);

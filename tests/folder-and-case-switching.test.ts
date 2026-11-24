import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseMultipleChartFiles,
  getFilesFromDirectoryHandle,
} from '../src/utils/fileParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

describe('Folder Input, Case Switching & Compressed Gzip Verification', () => {
  describe('Test 1: Verification that only .json.gz files exist in test_data', () => {
    it('should confirm that test_data contains only compressed .json.gz and no raw .json files', () => {
      const testDataDir = path.join(root, 'test_data');
      const files = fs.readdirSync(testDataDir);

      const jsonFiles = files.filter(
        (f) => f.endsWith('.json') && !f.endsWith('.json.gz'),
      );
      expect(jsonFiles).toEqual([]);

      const gzFiles = files.filter((f) => f.endsWith('.json.gz'));
      expect(gzFiles.length).toBeGreaterThanOrEqual(4);
      expect(gzFiles).toContain('EUR_USD_test_data.json.gz');
      expect(gzFiles).toContain('GBP_USD_test_data.json.gz');
      expect(gzFiles).toContain('USD_JPY_test_data.json.gz');
      expect(gzFiles).toContain('XAU_USD_test_data.json.gz');
    });
  });

  describe('Test 2: Case Switching Index Logic (Ctrl + Left / Right Wrap-around)', () => {
    it('should correctly cycle forward and backward across multiple cases', () => {
      const caseCount = 4;
      const getNext = (curr: number) => (curr + 1) % caseCount;
      const getPrev = (curr: number) => (curr - 1 + caseCount) % caseCount;

      expect(getNext(0)).toBe(1);
      expect(getNext(1)).toBe(2);
      expect(getNext(2)).toBe(3);
      expect(getNext(3)).toBe(0);

      expect(getPrev(0)).toBe(3);
      expect(getPrev(3)).toBe(2);
      expect(getPrev(2)).toBe(1);
      expect(getPrev(1)).toBe(0);
    });
  });

  describe('Test 3: Multiple File / Folder Parser', () => {
    it('should parse multiple mock chart files and sort cases alphabetically', async () => {
      const mockGzBuffer = fs.readFileSync(
        path.join(root, 'test_data', 'EUR_USD_test_data.json.gz'),
      );
      const mockGbpBuffer = fs.readFileSync(
        path.join(root, 'test_data', 'GBP_USD_test_data.json.gz'),
      );

      const file1 = new File([mockGzBuffer], 'EUR_USD_test_data.json.gz', {
        type: 'application/gzip',
      });
      const file2 = new File([mockGbpBuffer], 'GBP_USD_test_data.json.gz', {
        type: 'application/gzip',
      });

      const cases = await parseMultipleChartFiles([file2, file1]);
      expect(cases.length).toBe(2);
      expect(cases[0]?.name).toBe('EUR/USD');
      expect(cases[0]?.title).toBe('Asian Liquidity Sweep & London Expansion');
      expect(cases[0]?.group).toBe('Forex Majors');
      expect(cases[1]?.name).toBe('GBP/USD');
      expect(cases[1]?.title).toBe('Marubozu Key Level Breakout & Retest');
      expect(cases[1]?.group).toBe('Forex Majors');
      expect(cases[0]?.data.timeframes).toBeDefined();
    });
  });

  describe('Test 4: Native Directory Handle Reader (No Confirm Dialog)', () => {
    it('should extract files from mock FileSystemDirectoryHandle without error', async () => {
      const mockFile = new File(['{}'], 'test.json.gz');
      const mockDirHandle = {
        kind: 'directory',
        name: 'test_folder',
        values: async function* () {
          yield {
            kind: 'file',
            name: 'test.json.gz',
            getFile: async () => mockFile,
          };
        },
      };

      const files = await getFilesFromDirectoryHandle(mockDirHandle);
      expect(files.length).toBe(1);
      expect(files[0]?.name).toBe('test.json.gz');
    });
  });

  describe('Test 5: Case Selection Menu Structure & Pair-free Title Display', () => {
    it('should format case display title using title directly without currency pair prefix', () => {
      const mockCaseWithTitle = {
        id: 'case-1',
        name: 'EUR/USD',
        title: 'Asian Liquidity Sweep & London Expansion',
        filename: 'EUR_USD_test_data.json.gz',
        data: { symbol: 'EUR/USD', timeframes: {} },
      };

      const mockCaseWithoutTitle = {
        id: 'case-2',
        name: 'USD/JPY',
        filename: 'USD_JPY_test_data.json.gz',
        data: { symbol: 'USD/JPY', timeframes: {} },
      };

      const getDisplayTitle = (c: typeof mockCaseWithTitle) =>
        c.title || c.name || 'Case';

      expect(getDisplayTitle(mockCaseWithTitle)).toBe(
        'Asian Liquidity Sweep & London Expansion',
      );
      expect(getDisplayTitle(mockCaseWithTitle)).not.toContain('EUR/USD');
      expect(getDisplayTitle(mockCaseWithoutTitle as never)).toBe('USD/JPY');
    });

    it('should correctly structure cases into root ungrouped items and hoverable sub-menu groups', () => {
      const mockCases = [
        {
          id: '1',
          name: 'EUR/USD',
          title: 'Asian Sweep',
          group: 'Forex Majors',
          filename: '1.gz',
          data: {} as never,
        },
        {
          id: '2',
          name: 'GBP/USD',
          title: 'Marubozu Breakout',
          group: 'Forex Majors',
          filename: '2.gz',
          data: {} as never,
        },
        {
          id: '3',
          name: 'USD/JPY',
          title: 'Order Block Continuation',
          filename: '3.gz',
          data: {} as never,
        },
        {
          id: '4',
          name: 'XAU/USD',
          title: 'FVG Fill',
          group: 'Commodities & Metals',
          filename: '4.gz',
          data: {} as never,
        },
      ];

      const groupsMap = new Map<string, typeof mockCases>();
      const ungrouped: typeof mockCases = [];

      mockCases.forEach((c) => {
        if (c.group && c.group.trim()) {
          const gName = c.group.trim();
          if (!groupsMap.has(gName)) groupsMap.set(gName, []);
          groupsMap.get(gName)!.push(c);
        } else {
          ungrouped.push(c);
        }
      });

      // Ungrouped item stays at root menu level
      expect(ungrouped.length).toBe(1);
      expect(ungrouped[0]?.title).toBe('Order Block Continuation');

      // Groups are separated for flyout sub-menus
      expect(groupsMap.size).toBe(2);
      expect(groupsMap.get('Forex Majors')?.length).toBe(2);
      expect(groupsMap.get('Commodities & Metals')?.length).toBe(1);
    });
  });
});

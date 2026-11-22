export type ThemeMode = 'dark' | 'light';

export interface ChartThemeColors {
  background: string;
  textColor: string;
  fontSize: number;
  fontFamily: string;
  vertGridColor: string;
  horzGridColor: string;
  crosshairColor: string;
  crosshairLabelBg: string;
  priceScaleBorderColor: string;
  timeScaleBorderColor: string;
  upCandleColor: string;
  downCandleColor: string;
  contextMenuBg: string;
  contextMenuBorder: string;
  contextMenuText: string;
  contextMenuHoverBg: string;
}

export interface CanvasThemeColors {
  lineHoverColor: string;
  zoneHoverBorderColor: string;
  zoneLabelBg: string;
  zoneLabelBorderAlpha: number;
  zoneLabelTextColor: string;
  zoneLabelHoverTextColor: string;
}

export interface ThemeColors {
  chart: ChartThemeColors;
  canvas: CanvasThemeColors;
}

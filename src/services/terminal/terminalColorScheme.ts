/**
 * Terminal color-scheme reporting (DEC private mode 2031 / DSR 996).
 *
 * TUI applications such as pi and Claude Code pick a light or dark palette from
 * the host terminal. Termy renders inside Obsidian, whose appearance the user
 * can flip at any time, so the terminal has to both answer "what is the current
 * scheme?" and push an update when that answer changes.
 *
 * The protocol is the one implemented by contour/foot/ghostty/WezTerm:
 *
 * - `CSI ? 2031 h` enables color-scheme update notifications, `CSI ? 2031 l`
 *   disables them.
 * - `CSI ? 996 n` asks for the scheme right now.
 * - Both are answered with `CSI ? 997 ; 1 n` for dark and `CSI ? 997 ; 2 n` for
 *   light.
 *
 * xterm.js knows none of these, but it already answers `OSC 11 ; ? ST` from its
 * theme, so a terminal that also speaks 2031/996 covers every detection path a
 * modern TUI tries.
 */

export type TerminalColorScheme = 'dark' | 'light';

/** DEC private mode that enables color-scheme update notifications. */
export const COLOR_SCHEME_UPDATE_MODE = 2031;

/** DSR parameter a TUI sends to ask for the current color scheme. */
export const COLOR_SCHEME_REQUEST_PARAM = 996;

const COLOR_SCHEME_REPORT_PARAM = 997;
const DARK_REPORT_VALUE = 1;
const LIGHT_REPORT_VALUE = 2;

/**
 * Build the `CSI ? 997 ; N n` report for a scheme. Used both to answer
 * `CSI ? 996 n` and to push unsolicited updates while mode 2031 is enabled.
 */
export function encodeColorSchemeReport(scheme: TerminalColorScheme): string {
  const value = scheme === 'light' ? LIGHT_REPORT_VALUE : DARK_REPORT_VALUE;
  return `\x1b[?${COLOR_SCHEME_REPORT_PARAM};${value}n`;
}

/**
 * Classify a CSS color as light or dark.
 *
 * Accepts the shapes Obsidian theme variables actually produce: `#rgb`,
 * `#rrggbb`, `#rrggbbaa`, and `rgb()`/`rgba()`. Anything unparseable returns
 * `undefined` so callers can keep their previous answer rather than reporting a
 * wrong scheme.
 */
export function classifyColorScheme(color: string | undefined): TerminalColorScheme | undefined {
  const rgb = parseCssColor(color);
  if (!rgb) {
    return undefined;
  }

  // ITU-R BT.601 luma, the same weighting the terminal instance already uses
  // for its custom-background heuristic.
  const luma = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return luma < 128 ? 'dark' : 'light';
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function parseCssColor(color: string | undefined): Rgb | undefined {
  if (!color) {
    return undefined;
  }

  const value = color.trim().toLowerCase();
  if (value.startsWith('#')) {
    return parseHexColor(value.slice(1));
  }

  const functional = value.match(/^rgba?\(([^)]*)\)$/);
  if (!functional) {
    return undefined;
  }

  const channels = functional[1]
    .split(/[\s,/]+/)
    .filter((part) => part.length > 0)
    .slice(0, 3)
    .map(parseChannel);

  if (channels.length !== 3 || channels.some((channel) => channel === undefined)) {
    return undefined;
  }

  return { r: channels[0] as number, g: channels[1] as number, b: channels[2] as number };
}

function parseHexColor(hex: string): Rgb | undefined {
  if (!/^[0-9a-f]+$/.test(hex)) {
    return undefined;
  }

  if (hex.length === 3 || hex.length === 4) {
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16),
    };
  }

  if (hex.length === 6 || hex.length === 8) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }

  return undefined;
}

function parseChannel(part: string): number | undefined {
  if (part.endsWith('%')) {
    const percent = Number.parseFloat(part.slice(0, -1));
    return Number.isFinite(percent) ? clampChannel((percent / 100) * 255) : undefined;
  }

  const numeric = Number.parseFloat(part);
  return Number.isFinite(numeric) ? clampChannel(numeric) : undefined;
}

function clampChannel(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

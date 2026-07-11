import type { ThemeConfig } from 'antd'

// Core palette — dark green theme inspired by the reference moodboard.
export const colors = {
  bgVoid: '#060f0a',
  bgBase: '#0a1810',
  bgSurface: '#0f2417',
  bgSurfaceAlt: '#132c1c',
  border: 'rgba(140, 200, 150, 0.14)',
  borderStrong: 'rgba(140, 200, 150, 0.28)',

  accent: '#6fe45c',
  accentStrong: '#4bd63a',
  accentDim: 'rgba(111, 228, 92, 0.16)',

  textPrimary: '#f2f7f2',
  textSecondary: '#a9bcac',
  textMuted: '#728075',
} as const

export const fonts = {
  display: "'Anton', 'Archivo Black', sans-serif",
  body: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
} as const

export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: colors.accent,
    colorBgBase: colors.bgBase,
    colorBgContainer: colors.bgSurface,
    colorBgElevated: colors.bgSurfaceAlt,
    colorText: colors.textPrimary,
    colorTextSecondary: colors.textSecondary,
    colorBorder: colors.border,
    colorBorderSecondary: colors.border,
    fontFamily: fonts.body,
    borderRadius: 10,
    colorLink: colors.accent,
    colorLinkHover: colors.accentStrong,
  },
  components: {
    Button: {
      colorPrimary: colors.accent,
      algorithm: true,
      primaryShadow: 'none',
      fontWeight: 600,
    },
    Input: {
      colorBgContainer: colors.bgSurfaceAlt,
      activeBorderColor: colors.accent,
      hoverBorderColor: colors.accentStrong,
    },
    Layout: {
      bodyBg: colors.bgBase,
      headerBg: 'transparent',
      footerBg: colors.bgVoid,
    },
    Menu: {
      itemBg: 'transparent',
      itemColor: colors.textSecondary,
      itemHoverColor: colors.textPrimary,
      itemSelectedColor: colors.accent,
      horizontalItemSelectedColor: colors.accent,
    },
  },
}

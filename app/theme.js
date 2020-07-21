import { tint } from 'polished'

export default ({
  background,
  primary = '#ED2238',
  secondary = '#3361aa',
}) => ({
  primary: {
    base: primary,
    light: tint(0.25, primary),
  },
  secondary: {
    base: secondary,
    light: tint(0.25, secondary),
  },
  backgroundUrl: background,
  success: { base: '#7EB223' },
  error: { base: '#E52C32' },
  warning: { base: '#fdf9c2' },
  info: { base: '#3C88C2' },
  text: {
    dark: '#333',
    light: '#999',
    medium: '#58595b',
  },
  fonts: {
    body: `'Montserrat', sans-serif`,
    bold: `'Montserrat', sans-serif`,
    italic: `'Montserrat', sans-serif`,
    light: `'Montserrat', sans-serif`,
    regular: `'Montserrat', sans-serif`,
  },
  fields: {
    border: '#D8DCE0',
    focus: '#476882',
  },
  gray: {
    base: '#AEB3B9',
    dark: '#263E50',
    highlight: '#ECEDEF',
    light: '#D8DCE0',
    medium: '#959595',
  },
  icon: {
    base: '#3361aa',
  },
})

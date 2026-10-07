// Hidden SVG holding the shared watercolour filters. Rendered once in the root
// layout; any element in the page can reference them with `url(#sb-…)`.
//
// NOTE: keep this `width/height=0 + position:absolute` and NOT `display:none` —
// several browsers refuse to resolve filter references that live inside a
// display:none subtree.
export function PaintDefs() {
  return (
    <svg
      aria-hidden
      focusable="false"
      width="0"
      height="0"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      <defs>
        {/* Hand-drawn wobble for outlines and frames. */}
        <filter id="sb-rough" x="-4%" y="-4%" width="108%" height="108%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="3.4" xChannelSelector="R" yChannelSelector="G" />
        </filter>

        {/* Stronger wobble for large soft shapes (clouds, blobs). */}
        <filter id="sb-wobble" x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="12" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="26" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feGaussianBlur in="d" stdDeviation="1.4" />
        </filter>

        {/* Watercolour: wavering edge → blotchy pigment density → darker pooled rim. */}
        <filter id="sb-wash" x="-3%" y="-3%" width="106%" height="106%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="2" seed="8" result="warp" />
          <feDisplacementMap in="SourceGraphic" in2="warp" scale="15" xChannelSelector="R" yChannelSelector="G" result="shape" />
          <feTurbulence type="fractalNoise" baseFrequency="0.022 0.04" numOctaves="4" seed="3" result="grain" />
          <feColorMatrix
            in="grain"
            type="matrix"
            values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 0 1"
            result="gray"
          />
          <feComponentTransfer in="gray" result="grayAdj">
            <feFuncR type="linear" slope="0.8" intercept="0.66" />
            <feFuncG type="linear" slope="0.8" intercept="0.66" />
            <feFuncB type="linear" slope="0.8" intercept="0.66" />
          </feComponentTransfer>
          <feBlend in="shape" in2="grayAdj" mode="multiply" result="mottled" />
          <feComposite in="mottled" in2="shape" operator="in" result="paint" />
          <feMorphology in="shape" operator="erode" radius="2" result="inner" />
          <feComposite in="shape" in2="inner" operator="out" result="rim" />
          <feColorMatrix
            in="rim"
            type="matrix"
            values="0 0 0 0 0.14  0 0 0 0 0.09  0 0 0 0 0.16  0 0 0 0.3 0"
            result="rimDark"
          />
          <feMerge>
            <feMergeNode in="paint" />
            <feMergeNode in="rimDark" />
          </feMerge>
        </filter>

        {/* Lighter treatment for glow / mist shapes — soft edge only. */}
        <filter id="sb-soft" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="21" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="20" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feGaussianBlur in="d" stdDeviation="5" />
        </filter>
      </defs>
    </svg>
  );
}

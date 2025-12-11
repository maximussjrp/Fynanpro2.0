interface LogoProps {
  variant?: 'horizontal-light' | 'horizontal-dark' | 'icon-gradient' | 'icon-dark' | 'icon-small' | 'full';
  format?: 'png' | 'svg';
  width?: number;
  height?: number;
  className?: string;
  showText?: boolean;
}

export default function Logo({ 
  variant = 'horizontal-light',
  format = 'png',
  width, 
  height, 
  className = '',
  showText = false
}: LogoProps) {
  const logoMap = {
    'horizontal-light': `/images/logo/logo-horizontal-light.${format}`,
    'horizontal-dark': `/images/logo/logo-horizontal-dark.${format}`,
    'icon-gradient': `/images/logo/logo-icon-gradient.${format}`,
    'icon-dark': `/images/logo/logo-icon-dark.${format}`,
    'icon-small': `/images/logo/icon-small-1.png`,
    'full': `/images/logo/logo-icon-gradient.${format}`,
  };

  const src = logoMap[variant];
  const style: React.CSSProperties = {};
  if (width) style.width = width;
  if (height) style.height = height;

  if (showText) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <img
          src="/images/logo/logo-principal-sem-fundo.png"
          alt="FynanPro 2.0"
          style={{ height: '384px', width: 'auto' }}
        />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt="FynanPro"
      className={className}
      style={style}
    />
  );
}

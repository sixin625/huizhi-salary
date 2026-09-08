import { cn } from '@/lib/utils'

interface BrandIconProps {
  /** 边长（px） */
  size?: number
  /** 圆角半径（px） */
  radius?: number
  /** 「喙」字号（px） */
  fontSize?: number
  className?: string
}

/**
 * 品牌字标「喙」
 *
 * 渐变主色 + 高光内阴影，Apple Music app icon 质感。
 * 全站品牌标识的唯一来源 —— 侧边栏 / 登录页 / 后续海报都复用这里，
 * 改配色或质感只需改这一处。
 *
 * 配色走 CSS 变量，自动适配 paper（赤陶）/ obsidian（青瓷）双主题。
 */
export function BrandIcon({
  size = 36,
  radius = 12,
  fontSize = 15,
  className,
}: BrandIconProps) {
  return (
    <div
      className={cn(
        'grid shrink-0 place-items-center font-bold leading-none',
        className,
      )}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        fontSize,
        background:
          'linear-gradient(135deg, var(--primary) 0%, color-mix(in oklab, var(--primary) 86%, black) 100%)',
        color: 'var(--primary-foreground)',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.20), inset 0 -1px 0 rgba(0,0,0,0.10), 0 1px 2px rgba(0,0,0,0.05)',
      }}
      aria-hidden="true"
    >
      喙
    </div>
  )
}

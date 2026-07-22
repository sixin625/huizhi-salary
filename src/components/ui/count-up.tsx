import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export interface CountUpProps {
  value: number
  duration?: number
  decimals?: number
  prefix?: string
  suffix?: string
  format?: (value: number) => string
  className?: string
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

function formatNumber(value: number, decimals: number, prefix: string, suffix: string) {
  const formatted = value.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return `${prefix}${formatted}${suffix}`
}

/**
 * 数字滚动计数：从当前显示值平滑过渡到目标值。
 * - 初始加载时从 0 跳动到真实金额；
 * - 目标值变化时（如切换月份、实时编辑）从上一个值平滑补间；
 * - 系统开启「减少动态效果」时直接显示终值。
 */
export function CountUp({
  value,
  duration = 1100,
  decimals = 2,
  prefix = '¥',
  suffix = '',
  format,
  className,
}: CountUpProps) {
  const [display, setDisplay] = useState(0)
  const displayRef = useRef(0)
  const frameRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    const reduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const setBoth = (v: number) => {
      displayRef.current = v
      setDisplay(v)
    }

    if (reduceMotion) {
      setBoth(value)
      return
    }

    const from = displayRef.current
    startRef.current = null

    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now
      const elapsed = now - startRef.current
      const t = Math.min(elapsed / duration, 1)
      const eased = easeOutCubic(t)
      setBoth(from + (value - from) * eased)
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick)
      } else {
        setBoth(value)
      }
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [value, duration])

  const text = format ? format(display) : formatNumber(display, decimals, prefix, suffix)

  return <span className={cn('tabular-nums', className)}>{text}</span>
}

export default CountUp

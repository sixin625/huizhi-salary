import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import {
  DownloadIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  SendIcon,
  Undo2Icon,
  TrendingUpIcon,
  TrendingDownIcon,
  CircleDollarSignIcon,
  FileTextIcon,
  Trash2Icon,
} from 'lucide-react'
import { salaryApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type {
  SalaryRecord,
  SalaryRecordItem,
} from '@/types/database'

// ---- 类型（后端返回扁平字段而非嵌套对象）----

type SalaryRecordWithRelations = SalaryRecord & {
  employee_name: string | null
  campus_name: string | null
  department_name: string | null
  items: SalaryRecordItem[]
}

// ---- 货币格式化 ----

function formatCurrency(val: number): string {
  return (
    '¥' +
    val.toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  )
}

// ---- 组件 ----

export default function SalaryRecordsPage() {
  // ---- 数据状态 ----
  const [records, setRecords] = useState<SalaryRecordWithRelations[]>([])
  const [loading, setLoading] = useState(true)

  // ---- 选择状态 ----
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  // ---- 展开状态 ----
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // ---- 操作 loading ----
  const [actionId, setActionId] = useState<string | null>(null)

  // ---- 获取薪资记录 ----
  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const data = await salaryApi.list(yearMonth)
      setRecords((data ?? []) as SalaryRecordWithRelations[])
    } catch (err) {
      toast.error('获取薪资记录失败：' + (err instanceof Error ? err.message : ''))
    } finally {
      setLoading(false)
    }
  }, [yearMonth])

  // ---- 月份变化时重新加载 ----
  useEffect(() => {
    void fetchRecords()
  }, [fetchRecords])

  // ---- 汇总统计 ----
  const totalGross = useMemo(
    () => records.reduce((sum, r) => sum + r.gross_salary, 0),
    [records],
  )
  const totalDeduction = useMemo(
    () => records.reduce((sum, r) => sum + r.total_deduction, 0),
    [records],
  )
  const totalNet = useMemo(
    () => records.reduce((sum, r) => sum + r.net_salary, 0),
    [records],
  )
  const publishedCount = useMemo(
    () => records.filter((r) => r.status === 'published').length,
    [records],
  )
  const draftCount = records.length - publishedCount

  // ---- 展开/收起 ----
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // ---- 发布 ----
  const handlePublish = async (id: string) => {
    setActionId(id)
    try {
      await salaryApi.updateStatus(id, 'published')
      toast.success('薪资记录已发布，员工可见')
      void fetchRecords()
    } catch (err) {
      toast.error('发布失败：' + (err instanceof Error ? err.message : ''))
    } finally {
      setActionId(null)
    }
  }

  // ---- 撤回 ----
  const handleUnpublish = async (id: string) => {
    setActionId(id)
    try {
      await salaryApi.updateStatus(id, 'draft')
      toast.success('薪资记录已撤回为草稿')
      void fetchRecords()
    } catch (err) {
      toast.error('撤回失败：' + (err instanceof Error ? err.message : ''))
    } finally {
      setActionId(null)
    }
  }

  // ---- 删除 ----
  const handleDelete = async (record: SalaryRecordWithRelations) => {
    const isPublished = record.status === 'published'
    const msg = isPublished
      ? '该记录已发布，确定要删除吗？删除后不可恢复。'
      : '确定要删除这条薪资记录吗？删除后不可恢复。'
    if (!window.confirm(msg)) return

    setActionId(record.id)
    try {
      // 已发布记录先撤回再删除
      if (isPublished) {
        await salaryApi.updateStatus(record.id, 'draft')
      }
      await salaryApi.remove(record.id)
      toast.success('薪资记录已删除')
      void fetchRecords()
    } catch (err) {
      toast.error('删除失败：' + (err instanceof Error ? err.message : ''))
    } finally {
      setActionId(null)
    }
  }

  // ---- 导出 Excel ----
  const handleExport = () => {
    if (records.length === 0) {
      toast.error('当前月份无记录可导出')
      return
    }

    const exportData = records.map((r) => ({
      员工姓名: r.employee_name ?? '-',
      校区: r.campus_name ?? '-',
      部门: r.department_name ?? '-',
      应发工资: r.gross_salary,
      扣除合计: r.total_deduction,
      实发工资: r.net_salary,
      状态: r.status === 'published' ? '已发布' : '草稿',
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '薪资记录')
    XLSX.writeFile(wb, `薪资记录_${yearMonth}.xlsx`)
    toast.success('导出成功')
  }

  // ---- 渲染 ----
  return (
    <div className="space-y-4 p-6">
      {/* 页面标题 + 月份选择 + 导出 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">薪资记录</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            查看和管理月度薪资记录，支持发布与导出
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="record-month" className="text-xs">
              月份
            </Label>
            <Input
              id="record-month"
              type="month"
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
              className="w-40"
            />
          </div>
          <Button
            onClick={handleExport}
            disabled={records.length === 0}
            className={cn(
              'mt-auto self-end',
              'bg-gradient-to-r from-primary to-primary/85 text-primary-foreground',
              'hover:from-primary hover:to-primary/75',
            )}
          >
            <DownloadIcon />
            导出 Excel
          </Button>
        </div>
      </div>

      {/* 汇总统计卡片 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* 应发总额 */}
        <div className="glass-card glass-card-hover p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUpIcon className="size-4 text-[var(--income)]" />
            应发总额
          </div>
          <p className="mt-2 text-2xl font-bold text-[var(--income)]">
            {formatCurrency(totalGross)}
          </p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{records.length} 条记录</span>
          </div>
        </div>

        {/* 扣除总额 */}
        <div className="glass-card glass-card-hover p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingDownIcon className="size-4 text-[var(--deduction)]" />
            扣除总额
          </div>
          <p className="mt-2 text-2xl font-bold text-[var(--deduction)]">
            {formatCurrency(totalDeduction)}
          </p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>已发布 {publishedCount} 条</span>
            <span>·</span>
            <span>草稿 {draftCount} 条</span>
          </div>
        </div>

        {/* 实发总额 */}
        <div className="glass-card glass-card-hover p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleDollarSignIcon className="size-4 text-primary" />
            实发总额
          </div>
          <p className="mt-2 text-2xl font-bold text-primary">
            {formatCurrency(totalNet)}
          </p>
          <div className="mt-1 text-xs text-muted-foreground">
            应发 - 扣除 = 实发
          </div>
        </div>
      </div>

      {/* 工资单表格 */}
      <div className="glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              <TableHead className="w-8"></TableHead>
              <TableHead className="min-w-[80px]">员工姓名</TableHead>
              <TableHead className="min-w-[90px]">校区</TableHead>
              <TableHead className="min-w-[90px]">部门</TableHead>
              <TableHead className="min-w-[100px] text-right">应发</TableHead>
              <TableHead className="min-w-[100px] text-right">扣除</TableHead>
              <TableHead className="min-w-[100px] text-right">实发</TableHead>
              <TableHead className="min-w-[70px]">状态</TableHead>
              <TableHead className="min-w-[120px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="h-32 text-center text-muted-foreground"
                >
                  加载中...
                </TableCell>
              </TableRow>
            ) : records.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="h-32 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-2">
                    <FileTextIcon className="size-8 text-muted-foreground/50" />
                    <span>{yearMonth} 无薪资记录</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              records.map((record) => (
                <Fragment key={record.id}>
                  {/* 主行 */}
                  <TableRow className="border-border/30">
                    {/* 展开/收起 */}
                    <TableCell className="p-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => toggleExpand(record.id)}
                      >
                        {expandedIds.has(record.id) ? (
                          <ChevronDownIcon />
                        ) : (
                          <ChevronRightIcon />
                        )}
                      </Button>
                    </TableCell>

                    {/* 员工姓名 */}
                    <TableCell className="font-medium">
                      {record.employee_name ?? '-'}
                    </TableCell>

                    {/* 校区 */}
                    <TableCell className="text-muted-foreground">
                      {record.campus_name ?? '-'}
                    </TableCell>

                    {/* 部门 */}
                    <TableCell className="text-muted-foreground">
                      {record.department_name ?? '-'}
                    </TableCell>

                    {/* 应发 */}
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(record.gross_salary)}
                    </TableCell>

                    {/* 扣除 */}
                    <TableCell className="text-right font-mono text-sm text-[var(--deduction)]">
                      {formatCurrency(record.total_deduction)}
                    </TableCell>

                    {/* 实发 */}
                    <TableCell className="text-right font-mono text-sm font-bold">
                      {formatCurrency(record.net_salary)}
                    </TableCell>

                    {/* 状态 */}
                    <TableCell>
                      <Badge
                        variant={
                          record.status === 'published'
                            ? 'default'
                            : 'secondary'
                        }
                        className={
                          record.status === 'published'
                            ? 'bg-[var(--income-soft)] text-[var(--income)] border-[var(--income-soft)]'
                            : 'bg-muted text-muted-foreground'
                        }
                      >
                        {record.status === 'published' ? '已发布' : '草稿'}
                      </Badge>
                    </TableCell>

                    {/* 操作 */}
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {record.status === 'draft' ? (
                          <Button
                            size="sm"
                            onClick={() => handlePublish(record.id)}
                            disabled={actionId === record.id}
                          >
                            <SendIcon />
                            {actionId === record.id ? '发布中...' : '发布'}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUnpublish(record.id)}
                            disabled={actionId === record.id}
                          >
                            <Undo2Icon />
                            {actionId === record.id ? '撤回中...' : '撤回'}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-[var(--deduction)] hover:bg-[var(--deduction-soft)]"
                          onClick={() => handleDelete(record)}
                          disabled={actionId === record.id}
                          title="删除"
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* 展开行 — 明细 */}
                  {expandedIds.has(record.id) && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={9} className="bg-muted/20 p-4">
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-foreground">
                            薪资明细
                          </h4>
                          {record.items && record.items.length > 0 ? (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-border/50 text-xs text-muted-foreground">
                                    <th className="px-2 py-1 text-left font-medium">
                                      项目名称
                                    </th>
                                    <th className="px-2 py-1 text-left font-medium">
                                      类型
                                    </th>
                                    <th className="px-2 py-1 text-right font-medium">
                                      金额
                                    </th>
                                    <th className="px-2 py-1 text-left font-medium">
                                      备注
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {record.items.map((item) => (
                                    <tr
                                      key={item.id}
                                      className="border-b border-border/20"
                                    >
                                      <td className="px-2 py-1.5">
                                        {item.item_name}
                                      </td>
                                      <td className="px-2 py-1.5">
                                        <span
                                          className={cn(
                                            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                                            item.item_type === 'income'
                                              ? 'bg-[var(--income-soft)] text-[var(--income)] border-[var(--income-soft)]'
                                              : 'bg-[var(--deduction-soft)] text-[var(--deduction)] border-[var(--deduction-soft)]',
                                          )}
                                        >
                                          {item.item_type === 'income'
                                            ? '收入'
                                            : '扣除'}
                                        </span>
                                      </td>
                                      <td className="px-2 py-1.5 text-right font-mono">
                                        {formatCurrency(item.amount)}
                                      </td>
                                      <td className="px-2 py-1.5 text-muted-foreground">
                                        {item.remark ?? '-'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              暂无明细项
                            </p>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 底部统计 */}
      {!loading && records.length > 0 && (
        <div className="text-right text-sm text-muted-foreground">
          共 {records.length} 条记录 · 已发布 {publishedCount} 条 · 草稿{' '}
          {draftCount} 条
        </div>
      )}
    </div>
  )
}

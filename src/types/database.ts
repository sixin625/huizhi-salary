// ============================================================
// 青岛喙语教育科技有限公司 薪资管理网站
// 数据库类型定义
// ============================================================

// ---- 类型别名 ----

export type EmployeeStatus = 'active' | 'inactive'
export type SalaryRecordStatus = 'draft' | 'published'
export type SalaryItemType = 'income' | 'deduction'

// ---- campuses（校区）----

export type Campus = {
  id: string
  name: string
  code: string | null
  created_at: string | null
}

export type CampusInsert = {
  id?: string
  name: string
  code?: string | null
  created_at?: string | null
}

export type CampusUpdate = {
  id?: string
  name?: string
  code?: string | null
  created_at?: string | null
}

// ---- departments（部门）----

export type Department = {
  id: string
  name: string
  code: string | null
  created_at: string | null
}

export type DepartmentInsert = {
  id?: string
  name: string
  code?: string | null
  created_at?: string | null
}

export type DepartmentUpdate = {
  id?: string
  name?: string
  code?: string | null
  created_at?: string | null
}

// ---- employees（员工）----

export type Employee = {
  id: string
  username: string
  name: string
  phone: string
  email: string | null
  campus_id: string | null
  department_id: string | null
  campus_name?: string | null
  department_name?: string | null
  hire_date: string
  base_salary: number | null
  status: EmployeeStatus
  is_admin: boolean
  created_at: string | null
}

export type EmployeeInsert = {
  id?: string
  username: string
  password?: string
  name: string
  phone?: string
  email?: string | null
  campus_id?: string | null
  department_id?: string | null
  hire_date?: string
  base_salary?: number | null
  status?: EmployeeStatus
  is_admin?: boolean
  created_at?: string | null
}

export type EmployeeUpdate = {
  id?: string
  username?: string
  password?: string
  name?: string
  phone?: string
  email?: string | null
  campus_id?: string | null
  department_id?: string | null
  hire_date?: string
  base_salary?: number | null
  status?: EmployeeStatus
  is_admin?: boolean
  created_at?: string | null
}

// ---- salary_records（薪资记录主表）----

export type SalaryRecord = {
  id: string
  employee_id: string
  year_month: string
  campus_id: string | null
  department_id: string | null
  gross_salary: number
  total_deduction: number
  net_salary: number
  status: SalaryRecordStatus
  created_by: string | null
  created_at: string | null
  updated_at: string | null
}

export type SalaryRecordInsert = {
  id?: string
  employee_id: string
  year_month: string
  campus_id?: string | null
  department_id?: string | null
  gross_salary: number
  total_deduction?: number
  net_salary: number
  status?: SalaryRecordStatus
  created_by?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type SalaryRecordUpdate = {
  id?: string
  employee_id?: string
  year_month?: string
  campus_id?: string | null
  department_id?: string | null
  gross_salary?: number
  total_deduction?: number
  net_salary?: number
  status?: SalaryRecordStatus
  created_by?: string | null
  created_at?: string | null
  updated_at?: string | null
}

// ---- salary_record_items（薪资明细项）----

export type SalaryRecordItem = {
  id: string
  record_id: string
  item_name: string
  item_type: SalaryItemType
  amount: number
  remark: string | null
}

export type SalaryRecordItemInsert = {
  id?: string
  record_id: string
  item_name: string
  item_type: SalaryItemType
  amount: number
  remark?: string | null
}

export type SalaryRecordItemUpdate = {
  id?: string
  record_id?: string
  item_name?: string
  item_type?: SalaryItemType
  amount?: number
  remark?: string | null
}

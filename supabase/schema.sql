-- ============================================================
-- 青岛喙语教育科技有限公司 薪资管理网站
-- Database Schema (Supabase / PostgreSQL)
-- 文件: schema.sql
-- 说明: 建表 + 约束 + 索引 + RLS启用
-- ============================================================

-- 确保pgcrypto扩展可用（Supabase自带，gen_random_uuid()依赖于此）
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 表1: campuses（校区）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campuses (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        varchar(50) NOT NULL UNIQUE,          -- 校区名称（黄岛/市南）
    code        varchar(20) UNIQUE,                   -- 校区编码
    created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.campuses ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 表2: departments（部门/角色）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.departments (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        varchar(50) NOT NULL UNIQUE,          -- 部门名称
    code        varchar(20) UNIQUE,                   -- 编码（PRINCIPAL/TEACHER/SALES/HEAD_TEACHER/MARKETING）
    created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 表3: employees（员工）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employees (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid        UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,  -- 关联Supabase认证账号
    name            varchar(50) NOT NULL,            -- 姓名
    phone           varchar(20) NOT NULL,            -- 手机号
    email           varchar(100),                    -- 邮箱（登录用）
    campus_id       uuid        REFERENCES public.campuses(id) ON DELETE SET NULL,   -- 所属校区
    department_id   uuid        REFERENCES public.departments(id) ON DELETE SET NULL, -- 所属部门
    hire_date       date        NOT NULL,            -- 入职日期
    base_salary     numeric(10,2),                   -- 基本工资（月）
    status          varchar(10) DEFAULT 'active',    -- active/inactive
    is_admin        boolean     DEFAULT false,       -- 是否管理员
    created_at      timestamptz DEFAULT now()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_emp_campus  ON public.employees(campus_id);
CREATE INDEX IF NOT EXISTS idx_emp_dept    ON public.employees(department_id);
CREATE INDEX IF NOT EXISTS idx_emp_status  ON public.employees(status);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 表4: salary_records（薪资记录主表）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.salary_records (
    id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id       uuid          NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,    -- 关联员工
    year_month        varchar(7)    NOT NULL,                -- 薪资月份 'YYYY-MM'
    campus_id         uuid          REFERENCES public.campuses(id) ON DELETE SET NULL,             -- 冗余，便于按校区查询
    department_id     uuid          REFERENCES public.departments(id) ON DELETE SET NULL,         -- 冗余，便于按部门统计
    gross_salary      numeric(12,2) NOT NULL,                -- 应发合计
    total_deduction   numeric(12,2) DEFAULT 0,              -- 扣除合计
    net_salary        numeric(12,2) NOT NULL,                -- 实发金额
    status            varchar(10)   DEFAULT 'draft',        -- draft/published
    created_by        uuid,                                 -- 录入人ID
    created_at        timestamptz   DEFAULT now(),
    updated_at        timestamptz   DEFAULT now(),
    -- 唯一约束：同一员工同一月份只能有一条记录
    UNIQUE(employee_id, year_month)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_rec_emp_period ON public.salary_records(employee_id, year_month);
CREATE INDEX IF NOT EXISTS idx_rec_period     ON public.salary_records(year_month);
CREATE INDEX IF NOT EXISTS idx_rec_campus     ON public.salary_records(campus_id);

-- updated_at 自动更新触发器
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_salary_records_updated_at
    BEFORE UPDATE ON public.salary_records
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.salary_records ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 表5: salary_record_items（薪资明细项）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.salary_record_items (
    id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id   uuid          NOT NULL REFERENCES public.salary_records(id) ON DELETE CASCADE,  -- 关联薪资记录
    item_name   varchar(50)   NOT NULL,                -- 项目名称
    item_type   varchar(10)   NOT NULL,                -- income/deduction
    amount      numeric(12,2) NOT NULL,                -- 金额
    remark      text                                  -- 备注
);

CREATE INDEX IF NOT EXISTS idx_items_record ON public.salary_record_items(record_id);

ALTER TABLE public.salary_record_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 表6: salary_components（薪资科目配置）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.salary_components (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        varchar(50) NOT NULL,                 -- 科目名称
    code        varchar(30) UNIQUE,                   -- 编码
    kind        varchar(10) NOT NULL,                 -- income/deduction
    sort_order  int         DEFAULT 0                 -- 排序
);

ALTER TABLE public.salary_components ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 表7: salary_rules（薪资公式规则）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.salary_rules (
    id            uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id uuid      REFERENCES public.departments(id) ON DELETE SET NULL,  -- 按部门配置
    component_id  uuid      REFERENCES public.salary_components(id) ON DELETE CASCADE, -- 产出哪个科目
    formula       jsonb     NOT NULL,                 -- JSON-AST公式
    priority      int       DEFAULT 0,               -- 计算顺序
    enabled       boolean   DEFAULT true,             -- 是否启用
    created_at    timestamptz DEFAULT now()
);

ALTER TABLE public.salary_rules ENABLE ROW LEVEL SECURITY;

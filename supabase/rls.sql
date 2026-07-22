-- ============================================================
-- 青岛喙语教育科技有限公司 薪资管理网站
-- Row Level Security (RLS) Policies
-- 文件: rls.sql
-- 说明: 行级安全策略，区分管理员与普通员工权限
-- 注意: 执行本文件前请先执行 schema.sql
-- ============================================================

-- ============================================================
-- 辅助函数: is_admin()
-- 判断当前认证用户是否为管理员（employees表中is_admin=true）
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.employees
        WHERE user_id = auth.uid() AND is_admin = true
    );
$$;

-- ============================================================
-- 1. campuses（校区）RLS 策略
--    管理员: ALL | 员工: SELECT
-- ============================================================

-- 管理员策略
DROP POLICY IF EXISTS "admin_all_campuses" ON public.campuses;
CREATE POLICY "admin_all_campuses" ON public.campuses
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 员工只读策略
DROP POLICY IF EXISTS "emp_select_campuses" ON public.campuses;
CREATE POLICY "emp_select_campuses" ON public.campuses
    FOR SELECT TO authenticated
    USING (true);

-- ============================================================
-- 2. departments（部门/角色）RLS 策略
--    管理员: ALL | 员工: SELECT
-- ============================================================

-- 管理员策略
DROP POLICY IF EXISTS "admin_all_departments" ON public.departments;
CREATE POLICY "admin_all_departments" ON public.departments
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 员工只读策略
DROP POLICY IF EXISTS "emp_select_departments" ON public.departments;
CREATE POLICY "emp_select_departments" ON public.departments
    FOR SELECT TO authenticated
    USING (true);

-- ============================================================
-- 3. employees（员工）RLS 策略
--    管理员: ALL | 员工: 仅能查看自己的记录
-- ============================================================

-- 管理员策略
DROP POLICY IF EXISTS "admin_all_employees" ON public.employees;
CREATE POLICY "admin_all_employees" ON public.employees
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 员工查看自己记录的策略
DROP POLICY IF EXISTS "emp_select_self_employees" ON public.employees;
CREATE POLICY "emp_select_self_employees" ON public.employees
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- ============================================================
-- 4. salary_records（薪资记录主表）RLS 策略
--    管理员: ALL | 员工: 仅能查看已发布的本人薪资记录
-- ============================================================

-- 管理员策略
DROP POLICY IF EXISTS "admin_all_salary_records" ON public.salary_records;
CREATE POLICY "admin_all_salary_records" ON public.salary_records
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 员工查看已发布薪资记录的策略
DROP POLICY IF EXISTS "emp_select_salary_records" ON public.salary_records;
CREATE POLICY "emp_select_salary_records" ON public.salary_records
    FOR SELECT TO authenticated
    USING (
        employee_id IN (
            SELECT id FROM public.employees
            WHERE user_id = auth.uid()
        )
        AND status = 'published'
    );

-- ============================================================
-- 5. salary_record_items（薪资明细项）RLS 策略
--    管理员: ALL | 员工: 仅能查看已发布的本人薪资明细
-- ============================================================

-- 管理员策略
DROP POLICY IF EXISTS "admin_all_salary_record_items" ON public.salary_record_items;
CREATE POLICY "admin_all_salary_record_items" ON public.salary_record_items
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 员工查看已发布薪资明细的策略
DROP POLICY IF EXISTS "emp_select_salary_record_items" ON public.salary_record_items;
CREATE POLICY "emp_select_salary_record_items" ON public.salary_record_items
    FOR SELECT TO authenticated
    USING (
        record_id IN (
            SELECT id FROM public.salary_records
            WHERE employee_id IN (
                SELECT id FROM public.employees
                WHERE user_id = auth.uid()
            )
            AND status = 'published'
        )
    );

-- ============================================================
-- 6. salary_components（薪资科目配置）RLS 策略
--    管理员: ALL | 员工: 无权限
-- ============================================================

-- 管理员策略
DROP POLICY IF EXISTS "admin_all_salary_components" ON public.salary_components;
CREATE POLICY "admin_all_salary_components" ON public.salary_components
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ============================================================
-- 7. salary_rules（薪资公式规则）RLS 策略
--    管理员: ALL | 员工: 无权限
-- ============================================================

-- 管理员策略
DROP POLICY IF EXISTS "admin_all_salary_rules" ON public.salary_rules;
CREATE POLICY "admin_all_salary_rules" ON public.salary_rules
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

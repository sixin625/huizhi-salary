import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import AdminLayout from '@/components/layout/AdminLayout'
import EmployeeLayout from '@/components/layout/EmployeeLayout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/admin/DashboardPage'
import EmployeesPage from '@/pages/admin/EmployeesPage'
import SalaryInputPage from '@/pages/admin/SalaryInputPage'
import SalaryRecordsPage from '@/pages/admin/SalaryRecordsPage'
import PayslipPage from '@/pages/employee/PayslipPage'
import ProfilePage from '@/pages/employee/ProfilePage'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/admin',
    element: <ProtectedRoute role="admin" />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { index: true, element: <Navigate to="/admin/dashboard" replace /> },
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'employees', element: <EmployeesPage /> },
          { path: 'salary/input', element: <SalaryInputPage /> },
          { path: 'salary/records', element: <SalaryRecordsPage /> },
        ],
      },
    ],
  },
  {
    path: '/employee',
    element: <ProtectedRoute role="employee" />,
    children: [
      {
        element: <EmployeeLayout />,
        children: [
          { index: true, element: <Navigate to="/employee/payslip" replace /> },
          { path: 'payslip', element: <PayslipPage /> },
          { path: 'profile', element: <ProfilePage /> },
        ],
      },
    ],
  },
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '*',
    element: <Navigate to="/login" replace />,
  },
])

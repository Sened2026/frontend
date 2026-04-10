import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/AppLayout';
import { Login } from '@/pages/auth/Login';
import { Register } from '@/pages/auth/Register';
import { ForgotPassword } from '@/pages/auth/ForgotPassword';
import { ResetPassword } from '@/pages/auth/ResetPassword';

const QuoteSign = lazy(() => import('@/pages/quotes/QuoteSignPage').then(m => ({ default: m.QuoteSignPage })));
const QuoteTermsPage = lazy(() => import('@/pages/public/QuoteTermsPage').then(m => ({ default: m.QuoteTermsPage })));
const InvoiceView = lazy(() => import('@/pages/invoices/InvoiceViewPage').then(m => ({ default: m.InvoiceViewPage })));
const Dashboard = lazy(() => import('@/pages/Dashboard').then(m => ({ default: m.Dashboard })));
const HomePage = lazy(() => import('@/pages/public/HomePage').then(m => ({ default: m.HomePage })));
const LegalDocumentPage = lazy(() => import('@/pages/public/LegalDocumentPage').then(m => ({ default: m.LegalDocumentPage })));
const SubscribePage = lazy(() => import('@/pages/auth/SubscribePage').then(m => ({ default: m.SubscribePage })));

export const subscribeRoute = {
    path: '/subscribe',
    element: (
        <ProtectedRoute>
            <Suspense fallback={
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            }>
                <SubscribePage />
            </Suspense>
        </ProtectedRoute>
    ),
};

export const publicRoutes = [
    {
        path: '/',
        element: (
            <Suspense fallback={
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            }>
                <HomePage />
            </Suspense>
        ),
    },
    {
        path: '/auth/login',
        element: <Login />,
    },
    {
        path: '/auth/register',
        element: <Register />,
    },
    {
        path: '/auth/forgot-password',
        element: <ForgotPassword />,
    },
    {
        path: '/auth/reset-password',
        element: <ResetPassword />,
    },
    {
        path: '/login',
        element: <Navigate to="/auth/login" replace />,
    },
    {
        path: '/quotes/sign/:token/terms',
        element: (
            <Suspense fallback={
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            }>
                <QuoteTermsPage />
            </Suspense>
        ),
    },
    {
        path: '/quotes/sign/:token',
        element: (
            <Suspense fallback={
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            }>
                <QuoteSign />
            </Suspense>
        ),
    },
    {
        path: '/invoices/view/:token',
        element: (
            <Suspense fallback={
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            }>
                <InvoiceView />
            </Suspense>
        ),
    },
    {
        path: '/legal/:slug',
        element: (
            <Suspense fallback={
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            }>
                <LegalDocumentPage />
            </Suspense>
        ),
    },
];

export const protectedRoutes = {
    element: (
        <ProtectedRoute>
            <AppLayout />
        </ProtectedRoute>
    ),
    children: [
        {
            path: '/dashboard',
            element: (
                <Suspense fallback={
                    <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                }>
                    <Dashboard />
                </Suspense>
            ),
        },
    ],
};

export const redirectRoutes = [
    {
        path: '*',
        element: <Navigate to="/" replace />,
    },
];

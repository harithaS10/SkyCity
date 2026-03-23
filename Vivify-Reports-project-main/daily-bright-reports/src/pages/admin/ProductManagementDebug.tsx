import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ProductManagementDebug: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);

  const runDiagnostics = async () => {
    setIsLoading(true);
    const results: any = {};

    try {
      // Test 1: Check authentication
      results.auth = {
        token: localStorage.getItem('authToken') ? 'Present' : 'Missing',
        baseUrl: import.meta.env.VITE_API_BASE_URL || 'https://www.vivifysoft.in/VivifyReports'
      };

      // Test 2: Test categories API
      try {
        const categoriesRes = await api.categories.getAll();
        results.categories = {
          success: categoriesRes.success,
          data: categoriesRes.data,
          error: categoriesRes.success ? null : categoriesRes.message
        };
      } catch (error: any) {
        results.categories = {
          success: false,
          error: error.message,
          stack: error.stack
        };
      }

      // Test 3: Test products API
      try {
        const productsRes = await api.products.getAll();
        results.products = {
          success: productsRes.success,
          data: productsRes.data,
          error: productsRes.success ? null : productsRes.message
        };
      } catch (error: any) {
        results.products = {
          success: false,
          error: error.message,
          stack: error.stack
        };
      }

      // Test 4: Check component rendering
      results.component = {
        mounted: true,
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      results.generalError = {
        message: error.message,
        stack: error.stack
      };
    }

    setDebugInfo(results);
    setIsLoading(false);
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Product Management Debug</h1>
          <Button onClick={runDiagnostics} disabled={isLoading}>
            {isLoading ? 'Running Tests...' : 'Run Diagnostics'}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Diagnostic Results</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-96">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Fixes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded">
                <h3 className="font-semibold mb-2">1. Database Migration</h3>
                <p className="text-sm text-gray-600 mb-2">
                  Run the SQL migration script to create tables:
                </p>
                <code className="text-xs bg-gray-100 p-2 block rounded">
                  EmployeeReportingAPI/Migrations/add_product_management_tables.sql
                </code>
              </div>

              <div className="p-4 border rounded">
                <h3 className="font-semibold mb-2">2. API Server</h3>
                <p className="text-sm text-gray-600 mb-2">
                  Ensure the API server is running and accessible:
                </p>
                <code className="text-xs bg-gray-100 p-2 block rounded">
                  https://www.vivifysoft.in/VivifyReports/api/categories
                </code>
              </div>

              <div className="p-4 border rounded">
                <h3 className="font-semibold mb-2">3. Authentication</h3>
                <p className="text-sm text-gray-600 mb-2">
                  Verify you're logged in as admin:
                </p>
                <code className="text-xs bg-gray-100 p-2 block rounded">
                  Role: admin required for Product Management
                </code>
              </div>

              <div className="p-4 border rounded">
                <h3 className="font-semibold mb-2">4. Browser Console</h3>
                <p className="text-sm text-gray-600 mb-2">
                  Check browser console for JavaScript errors:
                </p>
                <code className="text-xs bg-gray-100 p-2 block rounded">
                  F12 → Console tab
                </code>
              </div>
            </div>
          </CardContent>
        </Card>

        {debugInfo.categories?.success && debugInfo.products?.success && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                <span className="font-semibold text-green-800">
                  APIs are working! The issue might be in the main component.
                </span>
              </div>
              <p className="text-sm text-green-700 mt-2">
                Try refreshing the page or clearing browser cache.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ProductManagementDebug;
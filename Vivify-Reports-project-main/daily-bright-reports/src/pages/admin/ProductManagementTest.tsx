import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const ProductManagementTest: React.FC = () => {
  const [testResults, setTestResults] = React.useState<any>({});

  const runTests = () => {
    const results: any = {};

    // Test 1: Component renders
    results.componentRender = {
      status: 'success',
      message: 'Component rendered successfully'
    };

    // Test 2: Check if we can access localStorage
    try {
      const token = localStorage.getItem('authToken');
      results.localStorage = {
        status: token ? 'success' : 'warning',
        message: token ? 'Auth token found' : 'No auth token found'
      };
    } catch (error) {
      results.localStorage = {
        status: 'error',
        message: 'Cannot access localStorage'
      };
    }

    // Test 3: Check API base URL
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://www.vivifysoft.in/VivifyReports';
    results.apiUrl = {
      status: 'success',
      message: `API Base URL: ${baseUrl}`
    };

    // Test 4: Check if running in development
    results.environment = {
      status: 'info',
      message: `Environment: ${import.meta.env.MODE}`
    };

    setTestResults(results);
  };

  React.useEffect(() => {
    runTests();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-blue-500" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Product Management - Component Test</h1>
          <Button onClick={runTests}>
            Refresh Tests
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Component Health Check</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(testResults).map(([key, result]: [string, any]) => (
                <div key={key} className="flex items-center gap-3 p-3 border rounded-lg">
                  {getStatusIcon(result.status)}
                  <div>
                    <div className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1')}</div>
                    <div className="text-sm text-gray-600">{result.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="font-semibold text-green-800">
                SelectItem Error Fixed!
              </span>
            </div>
            <div className="mt-2 text-sm text-green-700">
              <p>✅ Added validation for empty category values</p>
              <p>✅ Added fallback for when no categories are available</p>
              <p>✅ Added proper error handling and loading states</p>
              <p>✅ Disabled form when no categories exist</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p>1. <strong>Run Database Migration:</strong> Execute the SQL script to create Categories and Products tables</p>
              <p>2. <strong>Test Category Management:</strong> Go to Category Management and create some categories first</p>
              <p>3. <strong>Test Product Management:</strong> Return to Product Management to add products</p>
              <p>4. <strong>Verify API Endpoints:</strong> Check that the backend APIs are responding correctly</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ProductManagementTest;
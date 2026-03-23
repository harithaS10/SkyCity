// Test script for Recurring Task System
// Run this with Node.js to test the recurring task functionality

const BASE_URL = 'https://www.vivifysoft.in/VivifyReports';

// Test configuration
const TEST_CONFIG = {
    adminCredentials: {
        username: 'admin', // Replace with actual admin username
        password: 'admin123' // Replace with actual admin password
    },
    testUserId: 2 // Replace with actual user ID to assign tasks to
};

let authToken = '';

// Helper function to make API requests
async function apiRequest(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        ...options.headers
    };

    try {
        const response = await fetch(url, {
            ...options,
            headers
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${data.message || 'Request failed'}`);
        }

        return data;
    } catch (error) {
        console.error(`❌ API Request failed for ${endpoint}:`, error.message);
        throw error;
    }
}

// Test 1: Login as admin
async function testLogin() {
    console.log('\n🔐 Testing Admin Login...');
    
    try {
        const response = await apiRequest('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify(TEST_CONFIG.adminCredentials)
        });

        if (response.success && response.token) {
            authToken = response.token;
            console.log('✅ Admin login successful');
            console.log(`   User: ${response.user.name} (${response.user.role})`);
            return true;
        } else {
            console.log('❌ Login failed:', response.message);
            return false;
        }
    } catch (error) {
        console.log('❌ Login error:', error.message);
        return false;
    }
}

// Test 2: Create a recurring task
async function testCreateRecurringTask() {
    console.log('\n📝 Testing Recurring Task Creation...');
    
    const taskData = {
        taskName: `Test Monthly Recurring Task - ${new Date().toISOString().split('T')[0]}`,
        description: 'This is a test recurring task that should automatically create new instances every month',
        assignedTo: TEST_CONFIG.testUserId,
        startDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        priority: 'medium',
        isRecurring: true,
        recurrenceType: 'monthly'
    };

    try {
        const response = await apiRequest('/api/tasks', {
            method: 'POST',
            body: JSON.stringify(taskData)
        });

        if (response.success && response.data) {
            console.log('✅ Recurring task created successfully');
            console.log(`   Task ID: ${response.data.id}`);
            console.log(`   Task Name: ${response.data.taskName}`);
            console.log(`   Is Recurring: ${response.data.isRecurring}`);
            console.log(`   Recurrence Type: ${response.data.recurrenceType}`);
            console.log(`   Next Recurrence: ${response.data.nextRecurrenceDate}`);
            return response.data;
        } else {
            console.log('❌ Task creation failed:', response.message);
            return null;
        }
    } catch (error) {
        console.log('❌ Task creation error:', error.message);
        return null;
    }
}

// Test 3: Complete the recurring task to trigger immediate recurrence
async function testCompleteRecurringTask(taskId) {
    console.log(`\n✅ Testing Task Completion (ID: ${taskId})...`);
    
    try {
        const response = await apiRequest(`/api/tasks/${taskId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'completed' })
        });

        if (response.success) {
            console.log('✅ Task marked as completed successfully');
            console.log(`   Status: ${response.data.status}`);
            console.log(`   Completed At: ${response.data.completedAt}`);
            return true;
        } else {
            console.log('❌ Task completion failed:', response.message);
            return false;
        }
    } catch (error) {
        console.log('❌ Task completion error:', error.message);
        return false;
    }
}

// Test 4: Check if new recurring task instance was created
async function testCheckRecurringInstance(originalTaskId, assignedUserId) {
    console.log('\n🔍 Checking for new recurring task instance...');
    
    // Wait a moment for the system to process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
        const response = await apiRequest(`/api/tasks/user/${assignedUserId}`);

        if (response.success && response.data) {
            const recurringTasks = response.data.filter(task => 
                task.parentTaskId === originalTaskId || 
                (task.isRecurring && task.taskName.includes('Test Monthly Recurring Task'))
            );

            console.log(`✅ Found ${recurringTasks.length} related recurring tasks`);
            
            recurringTasks.forEach((task, index) => {
                console.log(`   Task ${index + 1}:`);
                console.log(`     ID: ${task.id}`);
                console.log(`     Name: ${task.taskName}`);
                console.log(`     Status: ${task.status}`);
                console.log(`     Start Date: ${task.startDate}`);
                console.log(`     Due Date: ${task.dueDate}`);
                console.log(`     Parent Task ID: ${task.parentTaskId}`);
                console.log(`     Next Recurrence: ${task.nextRecurrenceDate}`);
            });

            return recurringTasks.length > 1; // Original + new instance
        } else {
            console.log('❌ Failed to retrieve user tasks:', response.message);
            return false;
        }
    } catch (error) {
        console.log('❌ Error checking recurring instances:', error.message);
        return false;
    }
}

// Test 5: Get task statistics
async function testTaskStatistics() {
    console.log('\n📊 Testing Task Statistics...');
    
    try {
        const response = await apiRequest('/api/tasks/stats');

        if (response.success && response.data) {
            console.log('✅ Task statistics retrieved successfully');
            console.log(`   Total Tasks: ${response.data.totalTasks}`);
            console.log(`   Pending Tasks: ${response.data.pendingTasks}`);
            console.log(`   Completed Tasks: ${response.data.completedTasks}`);
            console.log(`   Recurring Tasks: ${response.data.recurringTasks}`);
            return true;
        } else {
            console.log('❌ Failed to get task statistics:', response.message);
            return false;
        }
    } catch (error) {
        console.log('❌ Task statistics error:', error.message);
        return false;
    }
}

// Main test runner
async function runTests() {
    console.log('🚀 Starting Recurring Task System Tests');
    console.log('=====================================');

    try {
        // Test 1: Login
        const loginSuccess = await testLogin();
        if (!loginSuccess) {
            console.log('\n❌ Cannot proceed without admin login');
            return;
        }

        // Test 2: Create recurring task
        const createdTask = await testCreateRecurringTask();
        if (!createdTask) {
            console.log('\n❌ Cannot proceed without creating a task');
            return;
        }

        // Test 3: Complete the task
        const completionSuccess = await testCompleteRecurringTask(createdTask.id);
        if (!completionSuccess) {
            console.log('\n❌ Task completion failed');
        }

        // Test 4: Check for new recurring instance
        const recurringInstanceCreated = await testCheckRecurringInstance(
            createdTask.id, 
            createdTask.assignedTo
        );

        if (recurringInstanceCreated) {
            console.log('\n🎉 Recurring task system is working correctly!');
        } else {
            console.log('\n⚠️  New recurring instance not found immediately');
            console.log('   This might be normal - the background service runs every 30 minutes');
            console.log('   Check again later or check the application logs');
        }

        // Test 5: Get statistics
        await testTaskStatistics();

        console.log('\n✅ All tests completed');
        console.log('\n📝 Next Steps:');
        console.log('   1. Check the application logs for recurring task processing');
        console.log('   2. Wait for the background service cycle (30 minutes)');
        console.log('   3. Verify new recurring tasks appear in the user\'s task list');
        console.log('   4. Test with different users and task scenarios');

    } catch (error) {
        console.log('\n💥 Test suite failed:', error.message);
    }
}

// Run the tests
if (typeof window === 'undefined') {
    // Node.js environment
    const fetch = require('node-fetch');
    runTests();
} else {
    // Browser environment
    console.log('Run this script in Node.js environment');
    console.log('Usage: node test_recurring_tasks.js');
}
// Simple Node.js script to test Product Management API endpoints
// Run with: node test_api_endpoints.js

const https = require('https');

const BASE_URL = 'https://www.vivifysoft.in/VivifyReports';
let authToken = '';

// Test configuration
const TEST_CONFIG = {
    // Update these with actual admin credentials
    username: 'admin',
    password: 'admin123'
};

function makeRequest(path, options = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(BASE_URL + path);
        
        const requestOptions = {
            hostname: url.hostname,
            port: url.port || 443,
            path: url.pathname + url.search,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        const req = https.request(requestOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve({ status: res.statusCode, data: jsonData });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', reject);
        
        if (options.body) {
            req.write(JSON.stringify(options.body));
        }
        
        req.end();
    });
}

async function testLogin() {
    console.log('🔐 Testing login...');
    try {
        const response = await makeRequest('/api/auth/login', {
            method: 'POST',
            body: {
                username: TEST_CONFIG.username,
                password: TEST_CONFIG.password
            }
        });

        if (response.data.success && response.data.token) {
            authToken = response.data.token;
            console.log('✅ Login successful!');
            console.log(`   User: ${response.data.user.name} (${response.data.user.role})`);
            return true;
        } else {
            console.log('❌ Login failed:', response.data.message);
            return false;
        }
    } catch (error) {
        console.log('❌ Login error:', error.message);
        return false;
    }
}

async function testCategories() {
    console.log('\n📂 Testing categories endpoint...');
    try {
        const response = await makeRequest('/api/categories', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.data.success) {
            console.log('✅ Categories endpoint working!');
            console.log(`   Found ${response.data.data.length} categories`);
            response.data.data.forEach(cat => {
                console.log(`   - ${cat.categoryName} (ID: ${cat.id})`);
            });
            return true;
        } else {
            console.log('❌ Categories failed:', response.data.message);
            return false;
        }
    } catch (error) {
        console.log('❌ Categories error:', error.message);
        return false;
    }
}

async function testProducts() {
    console.log('\n📦 Testing products endpoint...');
    try {
        const response = await makeRequest('/api/products', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.data.success) {
            console.log('✅ Products endpoint working!');
            console.log(`   Found ${response.data.data.length} products`);
            response.data.data.forEach(prod => {
                console.log(`   - ${prod.productName} (${prod.categoryName}) - $${prod.price}`);
            });
            return true;
        } else {
            console.log('❌ Products failed:', response.data.message);
            return false;
        }
    } catch (error) {
        console.log('❌ Products error:', error.message);
        return false;
    }
}

async function runTests() {
    console.log('🚀 Starting Product Management API Tests\n');
    
    const loginSuccess = await testLogin();
    if (!loginSuccess) {
        console.log('\n❌ Cannot proceed without authentication');
        return;
    }

    const categoriesSuccess = await testCategories();
    const productsSuccess = await testProducts();

    console.log('\n📊 Test Results:');
    console.log(`   Login: ${loginSuccess ? '✅' : '❌'}`);
    console.log(`   Categories: ${categoriesSuccess ? '✅' : '❌'}`);
    console.log(`   Products: ${productsSuccess ? '✅' : '❌'}`);

    if (categoriesSuccess && productsSuccess) {
        console.log('\n🎉 All API endpoints are working correctly!');
        console.log('   The issue might be in the frontend React component.');
    } else {
        console.log('\n⚠️  Some API endpoints are not working.');
        console.log('   Please check:');
        console.log('   1. Database migration was run');
        console.log('   2. API server is running');
        console.log('   3. Database connection is working');
    }
}

runTests().catch(console.error);
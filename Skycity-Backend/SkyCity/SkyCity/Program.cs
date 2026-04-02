using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SkycityBackend.Data;
using SkycityBackend.Middleware;
using SkycityBackend.Services;
using System.Text;
using Microsoft.OpenApi.Models;
using SkycityBackend.Interfaces;

var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddControllers(options =>
{
    // Register TenantFilter as a global MVC action filter
    options.Filters.Add<TenantFilter>();
}); builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "Skycity API", Version = "v1" });
});

// HTTP Context Accessor (needed for tenant filtering)
builder.Services.AddHttpContextAccessor();

// Database
string connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Server=localhost;Database=SkyCity;User Id=sa;Password=ENyxnMfNb2EjIv8pf9LN;MultipleActiveResultSets=true;TrustServerCertificate=True;Connect Timeout=30;Max Pool Size=50;";

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(connectionString));

// JWT Authentication
var jwtKey = builder.Configuration["Jwt:Key"] ?? "SkycityReportingSecretKey1234567890";
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });

// Configure CORS to allow the React Frontend to communicate with this Backend
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(
            "http://localhost:5173",
            "http://localhost:3000",
            "https://vivifysoft.in",
            "https://www.vivifysoft.in",
            "http://api.vivifysoft.com/SkyCity",
            "https://api.vivifysoft.in/SkyCity"
            )
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials()
              .SetIsOriginAllowed(origin => true);
    });
});

// Response Caching
builder.Services.AddResponseCaching();

// Custom Services
builder.Services.AddScoped<IAuditService, AuditService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IPermissionService, PermissionService>();
builder.Services.AddScoped<TenantFilter>();

builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
});

var app = builder.Build();

// Global exception handler - returns exact error details
app.UseExceptionHandler(errApp =>
{
    errApp.Run(async context =>
    {
        var ex = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>();
        context.Response.StatusCode = 500;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new
        {
            error = ex?.Error?.Message,
            type = ex?.Error?.GetType()?.Name,
            stackTrace = ex?.Error?.StackTrace,
            inner = ex?.Error?.InnerException?.Message
        });
    });
});

// Configure pipeline - Swagger enabled temporarily for debugging
app.UseSwagger();
app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "Skycity API v1"));

if (app.Environment.IsDevelopment())
{
}

app.UseCors("AllowFrontend");
app.UseResponseCaching();

// Handle OPTIONS preflight globally
app.Use(async (context, next) =>
{
    if (context.Request.Method == "OPTIONS")
    {
        context.Response.StatusCode = 204;
        await context.Response.CompleteAsync();
        return;
    }
    await next();
});

app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<TenantMiddleware>();
app.MapControllers();

app.Run();

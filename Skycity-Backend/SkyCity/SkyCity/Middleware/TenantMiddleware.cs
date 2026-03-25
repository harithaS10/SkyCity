using Microsoft.AspNetCore.Http;

namespace SkycityBackend.Middleware;

public class TenantMiddleware
{
    private readonly RequestDelegate _next;

    public TenantMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var user = context.User;

        // Skip tenant logic for super_admin
        if (!user.IsInRole("super_admin"))
        {
            var associationIdClaim = user.FindFirst("AssociationId")?.Value;
            if (!string.IsNullOrEmpty(associationIdClaim) && int.TryParse(associationIdClaim, out var associationId))
            {
                context.Items["AssociationId"] = associationId;
            }
        }

        // Call next middleware in pipeline
        await _next(context);
    }
}
using Microsoft.AspNetCore.Mvc.Filters;

namespace SkycityBackend.Middleware;

public class TenantFilter : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var user = context.HttpContext.User;
        if (user.IsInRole("super_admin"))
        {
            await next();
            return;
        }
        var associationIdClaim = user.FindFirst("AssociationId")?.Value;
        if (!string.IsNullOrEmpty(associationIdClaim))
        {
            context.HttpContext.Items["AssociationId"] = int.Parse(associationIdClaim);
        }
        await next();
    }
}

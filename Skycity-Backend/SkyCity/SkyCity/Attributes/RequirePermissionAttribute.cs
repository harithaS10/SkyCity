using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using SkycityBackend.Models;
using SkycityBackend.Services;
using System.Security.Claims;

namespace SkycityBackend.Attributes;

[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = true)]
public class RequirePermissionAttribute : Attribute, IAsyncAuthorizationFilter
{
    private readonly string _module;
    private readonly string _action;

    public RequirePermissionAttribute(string module, string action = "view")
    {
        _module = module;
        _action = action;
    }

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var user = context.HttpContext.User;
        if (user?.Identity?.IsAuthenticated != true)
        {
            context.Result = new UnauthorizedObjectResult(
                new ApiResponse { Success = false, Message = "Unauthorized" });
            return;
        }

        var role = user.FindFirst(ClaimTypes.Role)?.Value ?? string.Empty;

        var permService = context.HttpContext.RequestServices
            .GetRequiredService<IPermissionService>();

        var allowed = await permService.HasPermissionAsync(role, _module, _action);
        if (!allowed)
        {
            context.Result = new ObjectResult(
                new ApiResponse { Success = false, Message = $"You don't have '{_action}' permission on '{_module}'" })
            { StatusCode = 403 };
        }
    }
}

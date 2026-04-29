using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkycityBackend.Data;
using SkycityBackend.DTOs;
using SkycityBackend.Models;
using System.Security.Claims;

namespace SkycityBackend.Controllers;

[Authorize]
[ApiController]
[Route("branding")]
public class BrandingController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IWebHostEnvironment _env;
    private readonly IConfiguration _config;

    public BrandingController(AppDbContext context, IWebHostEnvironment env, IConfiguration config)
    {
        _context = context;
        _env = env;
        _config = config;
    }

    private int CurrentAssocId => int.TryParse(User.FindFirst("AssociationId")?.Value, out var id) ? id : 0;

    [HttpGet]
    public async Task<ActionResult> Get()
    {
        var assoc = await _context.Associations.IgnoreQueryFilters()
            .FirstOrDefaultAsync(a => a.Id == CurrentAssocId);
        if (assoc == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });

        return Ok(new ApiResponse<dynamic>
        {
            Success = true,
            Data = new
            {
                assoc.AssociationName,
                assoc.LogoUrl,
                assoc.ThemeColor,
            }
        });
    }

    // Public endpoint — returns branding for login page (no auth required)
    [AllowAnonymous]
    [HttpGet("public")]
    public async Task<ActionResult> GetPublic()
    {
        // Try DB first
        var assoc = await _context.Associations.IgnoreQueryFilters()
            .Where(a => a.IsActive)
            .OrderBy(a => a.Id)
            .FirstOrDefaultAsync();

        if (assoc != null)
            return Ok(new ApiResponse<dynamic>
            {
                Success = true,
                Data = new { assoc.ThemeColor, assoc.LogoUrl, assoc.AssociationName }
            });

        // Fallback: read from configuration (appsettings.json)
        var themeColor = _config["Branding:ThemeColor"] ?? "#0d9488";
        var logoUrl = _config["Branding:LogoUrl"];
        var associationName = _config["Branding:AssociationName"] ?? "SkyCity";

        return Ok(new ApiResponse<dynamic>
        {
            Success = true,
            Data = new { themeColor, logoUrl, associationName }
        });
    }

    [HttpPost("update")]
    public async Task<ActionResult> Update([FromBody] UpdateBrandingDto dto)
    {
        var assoc = await _context.Associations.IgnoreQueryFilters()
            .FirstOrDefaultAsync(a => a.Id == CurrentAssocId);
        if (assoc == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });

        if (dto.AssociationName != null) assoc.AssociationName = dto.AssociationName;
        if (dto.ThemeColor != null) assoc.ThemeColor = dto.ThemeColor;
        if (dto.LogoUrl != null) assoc.LogoUrl = dto.LogoUrl;

        await _context.SaveChangesAsync();
        return Ok(new ApiResponse<dynamic>
        {
            Success = true,
            Message = "Branding updated",
            Data = new { assoc.AssociationName, assoc.LogoUrl, assoc.ThemeColor }
        });
    }
}

public class UpdateBrandingDto
{
    public string? AssociationName { get; set; }
    public string? ThemeColor { get; set; }
    public string? LogoUrl { get; set; } // base64 data URL or URL string
}

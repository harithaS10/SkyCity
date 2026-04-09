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

    public BrandingController(AppDbContext context, IWebHostEnvironment env)
    {
        _context = context;
        _env = env;
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

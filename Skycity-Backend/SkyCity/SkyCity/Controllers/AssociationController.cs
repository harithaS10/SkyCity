using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkycityBackend.Data;
using SkycityBackend.DTOs;
using SkycityBackend.Models;
using SkycityBackend.Services;
using System.Security.Claims;

namespace SkycityBackend.Controllers;

[Authorize(Roles = "super_admin")]
[ApiController]
[Route("association")]
public class AssociationController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IAuditService _auditService;

    public AssociationController(AppDbContext context, IAuditService auditService)
    {
        _context = context;
        _auditService = auditService;
    }

    [HttpGet]
    public async Task<ActionResult> GetAssociations([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        // Only show associations that have an active admin user (IsDeleted=1)
        var query = _context.Associations
            .Where(a => _context.Users.IgnoreQueryFilters()
                .Any(u => u.AssociationId == a.Id && u.Role == UserRole.admin && u.IsDeleted));

        var total = await query.CountAsync();
        var items = await query
            .OrderBy(a => a.AssociationName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new {
                a.Id, a.AssociationName, a.Email, a.Phone, a.Address,
                a.ThemeColor, a.LogoUrl, a.Slug, a.IsActive, a.CreatedAt,
                userCount = _context.Users.IgnoreQueryFilters().Count(u => u.AssociationId == a.Id),
                reportCount = _context.WorkAllocations.Count(w => w.AssociationId == a.Id),
                admin = _context.Users.IgnoreQueryFilters()
                    .Where(u => u.AssociationId == a.Id && u.Role == UserRole.admin && u.IsDeleted)
                    .Select(u => new { u.Id, u.FullName, u.Username, u.Phone, u.IsActive })
                    .FirstOrDefault()
            })
            .ToListAsync();

        return Ok(new ApiResponse<dynamic>
        {
            Success = true,
            Data = new { Total = total, Page = page, PageSize = pageSize, TotalPages = (int)Math.Ceiling(total / (double)pageSize), Items = items }
        });
    }

    [AllowAnonymous]
    [HttpGet("{id}")]
    public async Task<ActionResult> GetAssociation(int id)
    {
        var association = await _context.Associations.IgnoreQueryFilters().FirstOrDefaultAsync(a => a.Id == id);
        if (association == null)
            return NotFound(new ApiResponse { Success = false, Message = "Association not found" });

        return Ok(new ApiResponse<Association> { Data = association });
    }

    [HttpPost]
    public async Task<ActionResult> CreateAssociation([FromBody] CreateAssociationDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(new ApiResponse { Success = false, Message = "Invalid input" });

        var association = new Association
        {
            AssociationName = dto.AssociationName,
            AdminId = dto.AdminId ?? 0,
            LogoUrl = dto.LogoUrl,
            ThemeColor = dto.ThemeColor ?? "#3B82F6",
            Slug = dto.Slug ?? dto.AssociationName.ToLower().Replace(" ", "-"),
            Address = dto.Address,
            Phone = dto.Phone,
            Email = dto.Email,
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };

        _context.Associations.Add(association);
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException?.Message.Contains("UNIQUE") == true || ex.InnerException?.Message.Contains("duplicate") == true)
        {
            return Conflict(new ApiResponse { Success = false, Message = "An association with this name or slug already exists." });
        }

        return CreatedAtAction(nameof(GetAssociation), new { id = association.Id }, new ApiResponse<Association> { Data = association, Success = true });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateAssociation(int id, [FromBody] UpdateAssociationDto dto)
    {
        if (id != dto.Id || !ModelState.IsValid)
            return BadRequest(new ApiResponse { Success = false, Message = "BadRequest" });

        var association = await _context.Associations.IgnoreQueryFilters().FirstOrDefaultAsync(a => a.Id == id);
        if (association == null)
            return NotFound(new ApiResponse { Success = false, Message = "Not Found" });

        var oldState = new { association.AssociationName, association.IsActive };

        association.AssociationName = dto.AssociationName ?? association.AssociationName;
        association.AdminId = dto.AdminId ?? association.AdminId;
        association.LogoUrl = dto.LogoUrl ?? association.LogoUrl;
        association.ThemeColor = dto.ThemeColor ?? association.ThemeColor;
        association.Slug = dto.Slug ?? association.Slug;
        association.Address = dto.Address ?? association.Address;
        association.Phone = dto.Phone ?? association.Phone;
        association.Email = dto.Email ?? association.Email;
        association.IsActive = dto.IsActive ?? association.IsActive;

        await _context.SaveChangesAsync();

        await _auditService.LogChangeAsync<Association>("Update", "Association", association);

        return Ok(new ApiResponse { Message = "Updated successfully" });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteAssociation(int id)
    {
        var rows = await _context.Database.ExecuteSqlRawAsync(
            "UPDATE Associations SET IsDeleted = 0 WHERE Id = {0}", id);

        if (rows == 0)
            return NotFound(new ApiResponse { Success = false, Message = "Not Found" });

        // Also soft-delete the admin user of this association
        await _context.Database.ExecuteSqlRawAsync(
            "UPDATE Users SET IsDeleted = 0 WHERE AssociationId = {0} AND Role = 'admin'", id);

        return Ok(new ApiResponse { Success = true, Message = "Deleted successfully" });
    }

    [HttpPatch("{id}/toggle-status")]
    public async Task<IActionResult> ToggleStatus(int id)
    {
        var association = await _context.Associations.IgnoreQueryFilters().FirstOrDefaultAsync(a => a.Id == id);
        if (association == null)
            return NotFound(new ApiResponse { Success = false, Message = "Not Found" });

        association.IsActive = !association.IsActive;
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse { Success = true, Message = $"Status set to {(association.IsActive ? "active" : "inactive")}" });
    }
}

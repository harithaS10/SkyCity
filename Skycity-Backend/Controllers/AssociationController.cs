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
[Route("api/[controller]")]
public class AssociationController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IAuditService _auditService;

    public AssociationController(AppDbContext context, IAuditService auditService)
    {
        _context = context;
        _auditService = auditService;
    }

    [ResponseCache(Duration = 300, VaryByQueryKeys = new[] { "page", "pageSize" })]
    [HttpGet]
    public async Task<ActionResult> GetAssociations([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var query = _context.Associations.AsQueryable();
        
        var total = await query.CountAsync();
        var items = await query
            .OrderBy(a => a.AssociationName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(new ApiResponse<dynamic>
        {
            Data = new
            {
                Total = total,
                Page = page,
                PageSize = pageSize,
                TotalPages = (int)Math.Ceiling(total / (double)pageSize),
                Items = items
            }
        });
    }

    [AllowAnonymous]
    [HttpGet("{id}")]
    public async Task<ActionResult> GetAssociation(int id)
    {
        var association = await _context.Associations.FindAsync(id);
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
            AdminId = dto.AdminId,
            LogoUrl = dto.LogoUrl,
            ThemeColor = dto.ThemeColor,
            Slug = dto.Slug,
            Address = dto.Address,
            Phone = dto.Phone,
            Email = dto.Email,
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };

        _context.Associations.Add(association);
        await _context.SaveChangesAsync();

        await _auditService.LogChangeAsync<Association>("Create", "Association", association);

        return CreatedAtAction(nameof(GetAssociation), new { id = association.Id }, new ApiResponse<Association> { Data = association });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateAssociation(int id, [FromBody] UpdateAssociationDto dto)
    {
        if (id != dto.Id || !ModelState.IsValid)
            return BadRequest(new ApiResponse { Success = false, Message = "BadRequest" });

        var association = await _context.Associations.FindAsync(id);
        if (association == null)
            return NotFound(new ApiResponse { Success = false, Message = "Not Found" });

        var oldState = new { association.AssociationName, association.IsActive };

        association.AssociationName = dto.AssociationName;
        association.AdminId = dto.AdminId;
        association.LogoUrl = dto.LogoUrl;
        association.ThemeColor = dto.ThemeColor;
        association.Slug = dto.Slug;
        association.Address = dto.Address;
        association.Phone = dto.Phone;
        association.Email = dto.Email;
        association.IsActive = dto.IsActive ?? association.IsActive;

        await _context.SaveChangesAsync();

        await _auditService.LogChangeAsync<Association>("Update", "Association", association);

        return Ok(new ApiResponse { Message = "Updated successfully" });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteAssociation(int id)
    {
        var association = await _context.Associations.FindAsync(id);
        if (association == null)
            return NotFound(new ApiResponse { Success = false, Message = "Not Found" });

        _context.Associations.Remove(association);
        await _context.SaveChangesAsync();

        await _auditService.LogChangeAsync<Association>("Delete", "Association", association);

        return Ok(new ApiResponse { Message = "Deleted successfully" });
    }
}

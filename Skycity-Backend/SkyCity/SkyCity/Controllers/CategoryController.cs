using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkycityBackend.Data;
using SkycityBackend.Models;

namespace SkycityBackend.Controllers;

[Authorize]
[ApiController]
[Route("categories")]
public class CategoryController : ControllerBase
{
    private readonly AppDbContext _context;

    public CategoryController(AppDbContext context) => _context = context;

    [HttpGet]
    public async Task<ActionResult> GetAll()
    {
        var assocIdStr = User.FindFirst("AssociationId")?.Value;
        var isSuperAdmin = User.IsInRole("super_admin");

        var query = _context.ComplaintCategories.AsQueryable();

        if (!isSuperAdmin && int.TryParse(assocIdStr, out var assocId) && assocId > 0)
            query = query.Where(c => c.AssociationId == assocId);

        var items = await query
            .Where(c => c.IsActive)
            .OrderBy(c => c.CategoryName)
            .Select(c => new {
                c.Id, c.CategoryName, c.Department,
                c.EstimatedTime, c.IsActive, c.AssociationId, c.CreatedAt,
                ProductCount = 0
            })
            .ToListAsync();

        return Ok(new ApiResponse<dynamic> { Success = true, Data = items });
    }

    [HttpGet("{id}")]
    public async Task<ActionResult> GetById(int id)
    {
        var cat = await _context.ComplaintCategories.FindAsync(id);
        if (cat == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });
        return Ok(new ApiResponse<ComplaintCategory> { Success = true, Data = cat });
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreateCategoryDto dto)
    {
        var associationId = dto.AssociationId;
        if (associationId == null || associationId == 0)
        {
            var claim = User.FindFirst("AssociationId")?.Value;
            associationId = int.TryParse(claim, out var id) && id > 0 ? id : null;
        }

        if (associationId == null || associationId == 0)
            return BadRequest(new ApiResponse { Success = false, Message = "AssociationId is required" });

        var cat = new ComplaintCategory
        {
            CategoryName = dto.CategoryName,
            Department = dto.Department,
            EstimatedTime = dto.EstimatedTime ?? 0,
            AssociationId = associationId.Value,
            IsActive = true
        };
        _context.ComplaintCategories.Add(cat);
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse<ComplaintCategory> { Success = true, Data = cat });
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> Update(int id, [FromBody] CreateCategoryDto dto)
    {
        var cat = await _context.ComplaintCategories.FindAsync(id);
        if (cat == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });
        cat.CategoryName = dto.CategoryName;
        cat.Department = dto.Department ?? cat.Department;
        cat.EstimatedTime = dto.EstimatedTime ?? cat.EstimatedTime;
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse { Success = true, Message = "Updated" });
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(int id)
    {
        var cat = await _context.ComplaintCategories.FindAsync(id);
        if (cat == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });
        _context.ComplaintCategories.Remove(cat);
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse { Success = true, Message = "Deleted" });
    }
}

public class CreateCategoryDto
{
    public string CategoryName { get; set; } = string.Empty;
    public string? Department { get; set; }
    public int? EstimatedTime { get; set; }
    public int? AssociationId { get; set; }
}

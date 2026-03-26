using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkycityBackend.Data;
using SkycityBackend.Models;

namespace SkycityBackend.Controllers;

[Authorize]
[ApiController]
[Route("subcategories")]
public class SubCategoryController : ControllerBase
{
    private readonly AppDbContext _context;
    public SubCategoryController(AppDbContext context) => _context = context;

    [HttpGet]
    public async Task<ActionResult> GetAll([FromQuery] int? categoryId = null)
    {
        var query = _context.SubCategories
            .Include(s => s.Category)
            .AsQueryable();

        if (categoryId.HasValue)
            query = query.Where(s => s.CategoryId == categoryId.Value);

        var items = await query
            .OrderBy(s => s.SubCategoryName)
            .Select(s => new {
                s.Id,
                s.CategoryId,
                CategoryName = s.Category != null ? s.Category.CategoryName : "",
                s.SubCategoryName,
                s.Description,
                s.IsActive,
                s.CreatedAt,
                ProductCount = 0
            })
            .ToListAsync();

        return Ok(new ApiResponse<dynamic> { Success = true, Data = items });
    }

    [HttpGet("{id}")]
    public async Task<ActionResult> GetById(int id)
    {
        var sub = await _context.SubCategories.Include(s => s.Category).FirstOrDefaultAsync(s => s.Id == id);
        if (sub == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });
        return Ok(new ApiResponse<SubCategory> { Success = true, Data = sub });
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] SubCategoryDto dto)
    {
        var exists = await _context.ComplaintCategories.AnyAsync(c => c.Id == dto.CategoryId);
        if (!exists) return BadRequest(new ApiResponse { Success = false, Message = "Category not found" });

        var sub = new SubCategory
        {
            CategoryId = dto.CategoryId,
            SubCategoryName = dto.SubCategoryName,
            Description = dto.Description,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        _context.SubCategories.Add(sub);
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse<SubCategory> { Success = true, Data = sub });
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> Update(int id, [FromBody] SubCategoryDto dto)
    {
        var sub = await _context.SubCategories.FindAsync(id);
        if (sub == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });

        sub.CategoryId = dto.CategoryId;
        sub.SubCategoryName = dto.SubCategoryName;
        sub.Description = dto.Description;
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse { Success = true, Message = "Updated" });
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(int id)
    {
        var sub = await _context.SubCategories.FindAsync(id);
        if (sub == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });
        _context.SubCategories.Remove(sub);
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse { Success = true, Message = "Deleted" });
    }
}

public class SubCategoryDto
{
    public int CategoryId { get; set; }
    public string SubCategoryName { get; set; } = string.Empty;
    public string? Description { get; set; }
}

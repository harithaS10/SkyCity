using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkycityBackend.Data;
using SkycityBackend.Models;

namespace SkycityBackend.Controllers;

[Authorize]
[ApiController]
[Route("works")]
public class WorkController : ControllerBase
{
    private readonly AppDbContext _context;
    public WorkController(AppDbContext context) => _context = context;

    [HttpGet]
    public async Task<ActionResult> GetAll()
    {
        var items = await _context.WorkCategories
            .Where(w => w.IsActive)
            .OrderBy(w => w.WorkTitle)
            .ToListAsync();
        return Ok(new ApiResponse<dynamic> { Success = true, Data = items });
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] WorkCategoryDto dto)
    {
        var work = new WorkCategory
        {
            WorkCode = dto.WorkCode,
            WorkTitle = dto.WorkTitle,
            WorkType = dto.WorkType ?? "Standard",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        _context.WorkCategories.Add(work);
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse<WorkCategory> { Success = true, Data = work });
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> Update(int id, [FromBody] WorkCategoryDto dto)
    {
        var work = await _context.WorkCategories.FindAsync(id);
        if (work == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });
        work.WorkCode = dto.WorkCode;
        work.WorkTitle = dto.WorkTitle;
        work.WorkType = dto.WorkType ?? work.WorkType;
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse { Success = true, Message = "Updated" });
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(int id)
    {
        var work = await _context.WorkCategories.FindAsync(id);
        if (work == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });
        work.IsActive = false;
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse { Success = true, Message = "Deleted" });
    }
}

public class WorkCategoryDto
{
    public string WorkCode { get; set; } = string.Empty;
    public string WorkTitle { get; set; } = string.Empty;
    public string? WorkType { get; set; }
}

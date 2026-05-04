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
        // Prevent duplicate work code or title
        var existing = await _context.WorkCategories
            .Where(w => w.WorkCode.ToLower() == dto.WorkCode.ToLower() || w.WorkTitle.ToLower() == dto.WorkTitle.ToLower())
            .FirstOrDefaultAsync();
        if (existing != null)
        {
            var reason = existing.WorkCode.ToLower() == dto.WorkCode.ToLower()
                ? $"Work code \"{existing.WorkCode}\" already exists."
                : $"Work title \"{existing.WorkTitle}\" already exists.";
            return BadRequest(new ApiResponse { Success = false, Message = reason });
        }

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

        // Prevent duplicate on update (exclude self)
        var duplicate = await _context.WorkCategories
            .Where(w => w.Id != id && (w.WorkCode.ToLower() == dto.WorkCode.ToLower() || w.WorkTitle.ToLower() == dto.WorkTitle.ToLower()))
            .FirstOrDefaultAsync();
        if (duplicate != null)
        {
            var reason = duplicate.WorkCode.ToLower() == dto.WorkCode.ToLower()
                ? $"Work code \"{duplicate.WorkCode}\" already exists."
                : $"Work title \"{duplicate.WorkTitle}\" already exists.";
            return BadRequest(new ApiResponse { Success = false, Message = reason });
        }

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

    // POST /works/bulk — bulk create work types, skipping duplicates
    [HttpPost("bulk")]
    public async Task<ActionResult> BulkCreate([FromBody] BulkWorkDto dto)
    {
        if (dto.Works == null || !dto.Works.Any())
            return BadRequest(new ApiResponse { Success = false, Message = "No works provided" });

        // Load all existing codes and titles for duplicate check
        var existingCodes = await _context.WorkCategories
            .Select(w => w.WorkCode.ToLower())
            .ToListAsync();
        var existingTitles = await _context.WorkCategories
            .Select(w => w.WorkTitle.ToLower())
            .ToListAsync();

        var toAdd = new List<WorkCategory>();
        var skipped = new List<string>();

        foreach (var w in dto.Works)
        {
            if (existingCodes.Contains(w.WorkCode.ToLower()))
            {
                skipped.Add($"Code \"{w.WorkCode}\" already exists");
                continue;
            }
            if (existingTitles.Contains(w.WorkTitle.ToLower()))
            {
                skipped.Add($"Title \"{w.WorkTitle}\" already exists");
                continue;
            }
            var work = new WorkCategory
            {
                WorkCode = w.WorkCode,
                WorkTitle = w.WorkTitle,
                WorkType = w.WorkType ?? "Standard",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            toAdd.Add(work);
            // Track in-memory to catch duplicates within the same batch
            existingCodes.Add(w.WorkCode.ToLower());
            existingTitles.Add(w.WorkTitle.ToLower());
        }

        if (toAdd.Count > 0)
        {
            _context.WorkCategories.AddRange(toAdd);
            await _context.SaveChangesAsync();
        }

        return Ok(new ApiResponse<dynamic>
        {
            Success = true,
            Data = new { created = toAdd.Count, skipped = skipped.Count, skippedDetails = skipped }
        });
    }
}

public class WorkCategoryDto
{
    public string WorkCode { get; set; } = string.Empty;
    public string WorkTitle { get; set; } = string.Empty;
    public string? WorkType { get; set; }
}

public class BulkWorkDto
{
    public List<WorkCategoryDto> Works { get; set; } = new();
}

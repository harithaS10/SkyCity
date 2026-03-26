using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkycityBackend.Data;
using SkycityBackend.Models;
using System.Security.Claims;

namespace SkycityBackend.Controllers;

[Authorize]
[ApiController]
[Route("reports")]
public class ReportsController : ControllerBase
{
    private readonly AppDbContext _context;
    public ReportsController(AppDbContext context) => _context = context;

    private int CurrentUserId => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
    private int CurrentAssocId => int.TryParse(User.FindFirst("AssociationId")?.Value, out var id) ? id : 0;

    [HttpGet]
    public async Task<ActionResult> GetAll(
        [FromQuery] int? adminId,
        [FromQuery] int? userId,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] string? workTitles)
    {
        var query = _context.WorkAllocations
            .Where(a => a.AssociationId == CurrentAssocId)
            .AsQueryable();

        if (userId.HasValue)
            query = query.Where(a => a.AssignedTo == userId.Value);

        if (startDate.HasValue)
            query = query.Where(a => a.CreatedAt >= startDate.Value);

        if (endDate.HasValue)
            query = query.Where(a => a.CreatedAt <= endDate.Value.AddDays(1));

        if (!string.IsNullOrEmpty(workTitles))
        {
            var titles = workTitles.Split(',').Select(t => t.Trim()).ToList();
            query = query.Where(a => titles.Contains(a.Title));
        }

        var items = await query.OrderByDescending(a => a.CreatedAt).ToListAsync();
        return Ok(new ApiResponse<dynamic> { Success = true, Data = items });
    }

    [HttpGet("my-reports")]
    public async Task<ActionResult> GetMyReports(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate)
    {
        var query = _context.WorkAllocations
            .Where(a => a.AssignedTo == CurrentUserId)
            .AsQueryable();

        if (startDate.HasValue)
            query = query.Where(a => a.CreatedAt >= startDate.Value);

        if (endDate.HasValue)
            query = query.Where(a => a.CreatedAt <= endDate.Value.AddDays(1));

        var items = await query.OrderByDescending(a => a.CreatedAt).ToListAsync();
        return Ok(new ApiResponse<dynamic> { Success = true, Data = items });
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreateReportDto dto)
    {
        var report = new WorkAllocation
        {
            Title = dto.Title,
            Description = dto.Description,
            WorkId = dto.WorkId ?? 0,
            AssignedTo = CurrentUserId,
            AssignedBy = CurrentUserId,
            AssociationId = CurrentAssocId,
            Priority = dto.Priority ?? "medium",
            Status = dto.Status ?? "completed",
            DueDate = dto.DueDate ?? DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };
        _context.WorkAllocations.Add(report);
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse<WorkAllocation> { Success = true, Data = report });
    }
}

public class CreateReportDto
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? WorkId { get; set; }
    public string? Priority { get; set; }
    public string? Status { get; set; }
    public DateTime? DueDate { get; set; }
}
